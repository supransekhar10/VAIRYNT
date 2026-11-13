import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import * as rime from '@livekit/agents-plugin-rime';
import { env } from '../apps/agent/dist/env.js';

let failed = false;

function silentWav(durationMs = 250, sampleRate = 16_000) {
  const samples = Math.floor((durationMs / 1_000) * sampleRate);
  const bytes = samples * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + bytes, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(bytes, 40);
  return buffer;
}

function safeFailure(provider, error) {
  failed = true;
  const status = typeof error === 'object' && error && 'status' in error ? error.status : 'unknown';
  const code = typeof error === 'object' && error && 'code' in error ? error.code : 'provider_error';
  console.log(JSON.stringify({ provider, ok: false, status, code }));
}

async function checkGemini() {
  try {
    const client = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
    await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: 'Reply only with OK.',
      config: { maxOutputTokens: 4 },
    });
    console.log(JSON.stringify({ provider: 'gemini', ok: true }));
  } catch (error) {
    safeFailure('gemini', error);
  }
}

async function checkGroq() {
  try {
    const client = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
    const audio = new File([silentWav()], 'silence.wav', { type: 'audio/wav' });
    await client.audio.transcriptions.create({ file: audio, model: env.GROQ_STT_MODEL, language: env.RIME_LANGUAGE });
    console.log(JSON.stringify({ provider: 'groq_stt', ok: true }));
  } catch (error) {
    safeFailure('groq_stt', error);
  }
}

async function checkRime() {
  const tts = new rime.TTS({
    apiKey: env.RIME_API_KEY,
    modelId: env.RIME_MODEL,
    speaker: env.RIME_VOICE,
    lang: env.RIME_LANGUAGE,
    useWebsocket: env.RIME_USE_WEBSOCKET,
  });
  const stream = tts.stream();
  try {
    stream.pushText('VAIRYNT voice check.');
    stream.endInput();
    let chunks = 0;
    for await (const item of stream) {
      if (typeof item !== 'symbol') chunks += 1;
    }
    const ok = chunks > 0;
    if (!ok) failed = true;
    console.log(JSON.stringify({ provider: 'rime_streaming_tts', ok, audioChunks: chunks }));
  } catch (error) {
    safeFailure('rime_streaming_tts', error);
  } finally {
    stream.close();
    await tts.close();
  }
}

await checkGemini();
await checkGroq();
await checkRime();
if (failed) process.exitCode = 1;
