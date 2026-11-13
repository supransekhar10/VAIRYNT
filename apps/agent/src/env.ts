import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), override: false });

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const workerEnvironment = z.object({
  LIVEKIT_URL: z.url().refine((value) => value.startsWith('ws://') || value.startsWith('wss://'), 'must be ws(s)'),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_AGENT_NAME: z.string().min(1).default('vairynt-voice'),
  RIME_API_KEY: z.string().min(1),
  RIME_MODEL: z.string().min(1).default('mistv2'),
  RIME_VOICE: z.string().min(1).default('celeste'),
  RIME_LANGUAGE: z.string().min(2).default('en'),
  RIME_USE_WEBSOCKET: booleanString.default(true),
  GOOGLE_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  GROQ_API_KEY: z.string().min(1),
  GROQ_STT_MODEL: z.string().min(1).default('whisper-large-v3-turbo'),
  TOOL_DELAY_MS: z.coerce.number().int().min(0).default(250),
  TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  TOOL_STRESS_MODE: booleanString.default(false),
});

export const env = workerEnvironment.parse(process.env);
