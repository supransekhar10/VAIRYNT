# VAIRYNT demonstration script (4–5 minutes)

1. **0:00–0:35 — Workspace and session.** Open the public HTTPS URL in a fresh browser, point out the field-service layout, then select Start session and approve microphone permission. Confirm Room connected and Agent ready separately.
2. **0:35–1:20 — Voice path.** Say: “Check inventory for 4471.” Show the technician transcript, the `lookupInventory` diagnostic event and the concise spoken Rime response.
3. **1:20–2:10 — Correction and interruption.** While the result is being prepared or spoken, say: “4472 instead.” Show the newer turn ID, stale old event if present, and that the latest request becomes 4472.
4. **2:10–2:55 — Rapid corrections and cancellation.** Say: “4471 … 4472 instead … 4473 instead,” then demonstrate “cancel that” during a configured slow lookup. Explain that VAD starts interruption before final transcription and stale work is fenced.
5. **2:55–3:40 — Manual and honest failure paths.** Ask for the X220 manual, then demonstrate either an unknown part or configured timeout. Point out the synthetic-data label and the clear status event.
6. **3:40–4:25 — Evidence.** Open diagnostics, show real turn IDs/delay/timeout values, export session evidence, and show the 20/20 provider-free fencing result. State that audible cutoff latency is intentionally unreported until waveform-measured.
7. **4:25–5:00 — Close.** Mute/unmute, end the session, and show the submission checklist and pending real browser/Rime trials.
