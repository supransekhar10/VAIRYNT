<div align="center">
  <h1>VAIRYNT</h1>
  <p><strong>A voice workspace for field-service technicians</strong></p>
  <p>Look up inventory, parts, and manuals through a real-time voice session.</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24+">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/LiveKit-Agents-4B5CFF" alt="LiveKit Agents">
</p>

> [!IMPORTANT]
> VAIRYNT currently uses synthetic inventory and service data. No public deployment URL or real-world inventory integration has been verified. Provider-free benchmark timings measure local test execution; they are not measurements of audible interruption latency.

## Overview

| Item | Details |
| --- | --- |
| Purpose | Give field-service technicians a hands-free way to look up inventory, part details, and manuals. |
| User interface | React web app with a LiveKit voice session, transcript, session controls, and diagnostics. |
| Voice pipeline | Silero VAD, Groq speech recognition, Gemini response generation, and Rime streaming text-to-speech. |
| Request handling | Room-scoped turn tracking supports corrections, cancellation, timeouts, and stale-result fencing. |
| Data | Local synthetic fixtures for inventory, parts, and manuals. |

## Features

- Start and end microphone-enabled technician sessions from the browser.
- Look up inventory, part information, and equipment manuals by voice.
- Correct or cancel a request while work is in progress.
- Keep requests isolated by LiveKit room and prevent stale responses from being delivered.
- Inspect tool events, timing controls, voice status, and exportable session evidence.

## Architecture

| Component | Responsibility |
| --- | --- |
| **Web client** | React and LiveKit Components provide the session interface and diagnostics. |
| **API service** | Fastify serves the built web app, issues short-lived LiveKit room tokens, and dispatches the configured agent. |
| **Voice agent** | LiveKit Agents coordinates speech recognition, Gemini, Rime, and technician lookup tools. |
| **Shared core** | TypeScript utilities shared across the workspaces. |

The browser calls the API over same-origin `/api/*` routes. Provider credentials stay in server-side environment variables and are not exposed to browser code. The API service and LiveKit worker are deployed separately.

## Getting started

### Requirements

- Node.js 24 or newer
- npm 11.6 or newer
- A LiveKit project
- Google Gemini, Groq, and Rime credentials for the voice worker

### Install and configure

```sh
git clone https://github.com/supransekhar10/VAIRYNT.git
cd VAIRYNT
npm ci
```

Copy the example environment file:

```sh
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Configure the LiveKit values for the API and worker. The API needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_AGENT_NAME`. The voice worker also needs `GOOGLE_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_STT_MODEL`, `RIME_API_KEY`, `RIME_MODEL`, `RIME_VOICE`, and `RIME_LANGUAGE`.

Never commit `.env` or `agent-secrets.env`. Keep provider credentials on the server and provide the worker secrets through your hosting environment.

### Run locally

Start each process in a separate terminal:

```sh
npm run dev:api
npm run dev:agent
npm run dev:web
```

Vite proxies `/api` requests to the local Fastify service. Microphone access requires HTTPS or `localhost`.

## Build and verification

```sh
npm run typecheck
npm test
npm run build
```

Optional provider and turn-fencing checks:

```sh
npm run check:providers
npm run benchmark:fencing --workspace @vairynt/agent
```

The provider check contacts Gemini, Groq, and Rime and requires valid credentials. The fencing benchmark uses synthetic data and makes no provider calls.

## Deployment

Build and run the web/API service with Docker:

```sh
docker build -f Dockerfile.web -t vairynt-web .
docker run --rm -p 3000:3000 --env-file .env vairynt-web
```

The root `Dockerfile` builds the LiveKit voice-agent worker. Deploy it separately, then configure the web service to dispatch the matching `LIVEKIT_AGENT_NAME`.

## Verification and evidence

The repository includes a provider-free fencing benchmark and a manual browser/Rime trial procedure. The real microphone-to-playback trials are pending. See [RIME_EVIDENCE.md](RIME_EVIDENCE.md), [the trial procedure](docs/browser-rime-trial-procedure.md), and [the submission checklist](docs/submission-checklist.md) for current scope and limitations.

## Project structure

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
