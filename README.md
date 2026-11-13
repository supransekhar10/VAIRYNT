# VAIRYNT

**A voice workspace for field service technicians.**

VAIRYNT lets a technician ask for inventory, part, and manual information by voice. A browser client joins a LiveKit room, while a separately hosted voice agent handles speech recognition, request processing, and spoken responses.

## Highlights

- Start a microphone-enabled session from the web app.
- Look up synthetic inventory, part, and manual data with voice.
- Correct or cancel a request while it is in progress.
- Keep turns isolated by room and prevent stale tool results from being delivered.
- Inspect session diagnostics and export local session evidence.

## Architecture

- **Web:** React, TypeScript, Vite, and LiveKit Components.
- **API:** Fastify issues short-lived LiveKit room tokens and explicitly dispatches the configured agent.
- **Voice agent:** LiveKit Agents with Silero VAD, Groq speech recognition, Gemini, and Rime streaming text-to-speech.
- **Shared core:** TypeScript utilities used by the workspaces.

The web service and voice agent run as separate processes. The web service serves the built frontend and same-origin `/api/*` routes. Provider credentials belong in server-side environment variables and are never sent to the browser.

## Requirements

- Node.js 24 or newer
- npm 11.6 or newer
- A LiveKit project
- Provider credentials for the voice agent: Google Gemini, Groq, and Rime

## Local development

1. Install dependencies and create a local environment file:

   ```sh
   npm ci
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

2. Fill in `.env`. The API needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_AGENT_NAME`. The voice agent also needs `GOOGLE_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_STT_MODEL`, `RIME_API_KEY`, `RIME_MODEL`, `RIME_VOICE`, and `RIME_LANGUAGE`.

3. Run each workspace in a separate terminal:

   ```sh
   npm run dev:api
   npm run dev:agent
   npm run dev:web
   ```

   The Vite development server proxies `/api` requests to the local API. Microphone access requires HTTPS or `localhost`.

## Build and verification

```sh
npm run typecheck
npm test
npm run build
npm run check:providers
npm run benchmark:fencing --workspace @vairynt/agent
```

The provider check calls Gemini, Groq, and Rime and requires valid credentials. The fencing benchmark uses synthetic data and makes no provider calls. Its elapsed times measure local test execution; they are not audible interruption latency measurements.

## Production

Build and run the web/API service with Docker:

```sh
docker build -f Dockerfile.web -t vairynt-web .
docker run --rm -p 3000:3000 --env-file .env vairynt-web
```

The root `Dockerfile` builds the LiveKit voice-agent worker image. Deploy that worker separately and configure its provider secrets in the hosting environment. See [.env.example](.env.example) for variable names and [RIME_EVIDENCE.md](RIME_EVIDENCE.md) for the current evidence status and measurement limitations.

## Repository layout

```text
apps/
  agent/       LiveKit voice worker
  api/         Token and room-dispatch API
  web/         Browser client
packages/
  core/        Shared TypeScript utilities
docs/          Demo and manual trial procedures
evidence/      Benchmark output and browser-trial records
scripts/       Provider verification
```

The demo outline and submission checklist are in [docs/](docs/). Evidence files are retained because the benchmark and trial procedures generate or consume them.
