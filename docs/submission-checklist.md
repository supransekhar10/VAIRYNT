# Submission checklist

- [x] `npm run build` succeeds.
- [x] Focused agent tests pass.
- [x] Provider-free fencing benchmark exports 20/20 passed state trials.
- [x] Web/API Dockerfile serves the built frontend and same-origin `/api` routes.
- [x] Agent Dockerfile packages fixtures and checks the Silero VAD asset.
- [x] `.env` and `.env.*` are ignored and excluded from Docker contexts.
- [ ] Set the web service variables from the intended LiveKit Cloud project.
- [ ] Create/deploy the `vairynt-voice` worker with LiveKit Cloud-managed credentials and provider secrets.
- [ ] Confirm `lk agent status` and inspect worker logs.
- [ ] Obtain a public HTTPS web-service URL.
- [ ] With the local worker stopped, open that URL in a fresh browser; grant microphone permission; confirm agent ready, transcript, tool event, and audible Rime response.
- [ ] Record the five pending browser/Rime trials using the waveform procedure. Do not add audible cutoff latency without measured local output silence.
