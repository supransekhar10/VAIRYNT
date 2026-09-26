import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import Fastify from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env } from './env.js';

const VOICE_AGENT_NAME = env.LIVEKIT_AGENT_NAME;
const tokenRequest = z.object({}).strict();
const webRoot = resolve(fileURLToPath(new URL('../../web/dist/', import.meta.url)));
const indexFile = resolve(webRoot, 'index.html');
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
};
const rateWindows = new Map<string, { count: number; resetAt: number }>();

const app = Fastify({ logger: true });

app.get('/api/health', async () => ({ ok: true, service: 'vairynt-web-api' }));

app.post('/api/token', async (request, reply) => {
  const now = Date.now();
  const current = rateWindows.get(request.ip);
  const windowMs = env.TOKEN_RATE_LIMIT_WINDOW_SECONDS * 1_000;
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  rateWindows.set(request.ip, entry);
  if (entry.count > env.TOKEN_RATE_LIMIT_MAX) {
    reply.header('retry-after', Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)));
    return reply.code(429).send({ error: 'Too many session requests. Try again shortly.' });
  }
  tokenRequest.parse(request.body ?? {});
  const roomName = `vairynt-${randomUUID()}`;
  const participantIdentity = `technician-${randomUUID()}`;
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: 'Field Technician',
    ttl: `${env.SESSION_TTL_SECONDS}s`,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: VOICE_AGENT_NAME })],
  });

  const participantToken = await token.toJwt();
  return reply.code(201).send({ server_url: env.LIVEKIT_URL, participant_token: participantToken });
});

app.get('/', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(indexFile)));
app.get('/*', async (request, reply) => {
  const requested = (request.params as { '*': string })['*'];
  const target = resolve(webRoot, requested || 'index.html');
  if (!target.startsWith(`${webRoot}${sep}`)) return reply.code(404).send({ error: 'Not found' });
  try {
    return reply.type(contentTypes[extname(target)] ?? 'application/octet-stream').send(await readFile(target));
  } catch {
    if (extname(requested)) return reply.code(404).send({ error: 'Not found' });
    return reply.type('text/html; charset=utf-8').send(await readFile(indexFile));
  }
});

try {
  await app.listen({ host: '0.0.0.0', port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
