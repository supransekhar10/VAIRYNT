# VAIRYNT submission build

VAIRYNT is a technician voice workspace: a same-origin React/Fastify web service issues short-lived LiveKit room tokens and explicitly dispatches the persistent `vairynt-voice` agent. The agent uses one LiveKit-managed pipeline with Silero VAD, Groq STT, Gemini, and Rime streaming TTS.

## Production web service

Build and start the web/API service from the repository root:

```sh
npm ci
npm run build
npm start
```

It serves the built frontend and `/api/*` on `0.0.0.0:$PORT`; the browser makes same-origin `/api/token` requests. Docker build/run commands are:

```sh
docker build -f Dockerfile.web -t vairynt-web .
docker run --rm -p 3000:3000 --env-file .env vairynt-web
```

Required web-service variables: `PORT`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_AGENT_NAME=vairynt-voice`. Optional bounded controls: `SESSION_TTL_SECONDS` (60–600, default 300), `TOKEN_RATE_LIMIT_MAX` (default 6), and `TOKEN_RATE_LIMIT_WINDOW_SECONDS` (default 60). Provider keys are not required by this service and must not be set in browser variables.

For local split development, run `npm run dev:api`, `npm run dev:agent`, and `npm run dev:web` in separate terminals. Vite proxies `/api` to the local Fastify server.

## LiveKit Cloud worker

The root `Dockerfile` is the LiveKit Cloud agent image. It includes the agent fixtures and verifies the packaged Silero ONNX VAD asset. It excludes `.env` files through `.dockerignore`.

Authenticate and select the intended LiveKit Cloud project, then create or deploy from the repository root:

```sh
lk cloud auth
lk project set-default "YOUR_PROJECT"
lk agent create --secrets-file ./agent-secrets.env .
# later versions
lk agent deploy .
lk agent status
lk agent logs
```

`agent-secrets.env` must contain `GOOGLE_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_STT_MODEL`, `RIME_API_KEY`, `RIME_MODEL`, `RIME_VOICE`, `RIME_LANGUAGE`, `RIME_USE_WEBSOCKET`, `TOOL_DELAY_MS`, `TOOL_TIMEOUT_MS`, and `TOOL_STRESS_MODE`. Do not include it in source control. LiveKit Cloud supplies `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the hosted agent; set the web-service LiveKit variables from the same Cloud project so explicit `vairynt-voice` dispatches match the worker.

Do not include `.env`, `agent-secrets.env`, `node_modules`, or generated `dist` directories in a shared or submission archive. Rotate credentials immediately if any populated environment file has been shared.

## Evidence and checks

```sh
npm run check:providers
npm run test --workspace @vairynt/agent
npm run benchmark:fencing --workspace @vairynt/agent
npm run build
```

`check:providers` exits non-zero if Gemini, Groq STT, or Rime streaming TTS fails. Run it after setting provider secrets and before recording browser evidence.

The provider-free benchmark exports raw and computed records under `evidence/`. Browser/Rime trials are intentionally pending until the configured Gemini model can generate a real reply and browser output is captured with one local waveform clock. See `RIME_EVIDENCE.md`.

No public deployment URL has been verified for this repository. Do not treat the service as deployed until a hosting provider reports a URL and the fresh-browser checklist passes.
