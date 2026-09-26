# Browser microphone/Rime trial procedure

Use one browser, one LiveKit room, and one local monotonic recording clock for each trial. Start the API, agent, and web app; grant microphone permission; select Start session; confirm both room connection and agent readiness before speaking.

For each pending entry in `evidence/browser-rime-trials.json`, record the browser output to a local waveform-capable capture tool. Speak the stated initial request, wait until the agent is audibly playing or a tool is in flight, then speak the stated correction. Record the local monotonic time for the correction speech onset and the first sustained silence in the captured agent-output waveform.

Use `4471` followed by `4472 instead` for trial 01. Use `4471`, `4472 instead`, then `4473 instead` for trial 02. Say `cancel that` while a lookup is in flight for trial 03. Force the configured tool timeout for trial 04. For trial 05, interrupt an audible reply with a corrected identifier and confirm that only the replacement reply is heard.

Set `toolDelayMs` and `correctionAtMs` in the JSON to the actual values used. If 800 ms does not leave enough time for a tool to be in flight, increase the tool delay and record that value. Only populate `audibleCutoffLatencyMs` when both timestamps came from the same captured output recording; otherwise leave it `null` and describe the limitation or failure.
