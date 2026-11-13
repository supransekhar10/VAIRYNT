import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), override: false });

const apiEnvironment = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
  TOKEN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(6),
  TOKEN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  LIVEKIT_URL: z.url().refine((value) => value.startsWith('ws://') || value.startsWith('wss://'), 'must be ws(s)'),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_AGENT_NAME: z.string().min(1).default('vairynt-voice'),
});

export const env = apiEnvironment.parse(process.env);
