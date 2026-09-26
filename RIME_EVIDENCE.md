# Rime evidence

## Active settings

The worker reads `RIME_MODEL`, `RIME_VOICE`, `RIME_LANGUAGE`, and `RIME_USE_WEBSOCKET` explicitly in its process entry point and passes them to the official LiveKit Rime plugin. Their configured values are not reproduced here because local environment values must not be printed. Transport is runtime-configured through `RIME_USE_WEBSOCKET`; the recorded provider check established that the configured Rime streaming path returned 24 audio chunks.

The browser distinguishes the worker's real `configured` event from its real LiveKit session `speaking` event. Neither is reported as a measured audible cutoff: a browser waveform capture remains required for that claim.

## Methods and results

`npm run benchmark:fencing --workspace @vairynt/agent` runs 20 provider-free state trials through the production `RoomTurnManager` and `createLookupService`: 8 ignored-cancellation corrections, 4 rapid corrections, 4 explicit cancels, 2 timeouts, and 2 room-isolation trials. It uses a 2000 ms tool delay and an 800 ms correction point where a correction or cancellation is applicable. Raw events/results export to `evidence/fencing-benchmark.raw.json`; computed denominators export to `evidence/fencing-benchmark.results.json`.

These state trials do not measure microphone capture, synthesis, browser playout, or audible interruption. Their elapsed values are local test durations only and must never be treated as audible cutoff latency.

## Real browser/Rime trials

Five real browser microphone/Rime trials are defined in `evidence/browser-rime-trials.json`; all five remain pending (denominator: 0/5 run). Follow `docs/browser-rime-trial-procedure.md` and retain the captured local waveform/timestamps with the JSON log. Do not report audible cutoff latency until waveform silence is measured against correction onset on the same local clock.

## Failures and limitations

The provider check was repeated on 2026-09-26 after changing the Gemini default to `gemini-3.8-flash`. Gemini generation and Groq transcription both succeeded, and Rime returned 21 streaming audio chunks. Run `npm run check:providers` again after rotating credentials and before recording browser evidence. No provider calls were made by the benchmark. No audible latency figure, synchronized-clock subtraction, inferred playout result, deployment URL, or fresh-browser deployment verification is reported.

The submission package was locally checked with the voice worker stopped: its same-origin health endpoint, built HTML, and built JavaScript asset returned successfully, and a fresh headless browser loaded the page. This validates packaging only; it does not run the five microphone/Rime trials or establish a public deployment.
