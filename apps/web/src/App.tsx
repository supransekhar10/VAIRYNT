import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTranscriptions,
  useVoiceAssistant,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { useEffect, useState } from 'react';
import { webEnv } from './env';

type Credentials = { server_url: string; participant_token: string };
type BrowserToolEvent = {
  type: 'vairynt.tool';
  tool: 'lookupInventory' | 'lookupPart' | 'lookupManual';
  requestId: string;
  identifier: string;
  status: string;
  durationMs?: number;
  epoch: number;
  delayMs: number;
  timeoutMs: number;
  stressMode: boolean;
};
type BrowserVoiceEvent = { type: 'vairynt.voice'; status: 'configured' | 'speaking'; agentState: string };

function ConsoleBody() {
  const connectionState = useConnectionState();
  const { agent, state: agentState } = useVoiceAssistant();
  const transcripts = useTranscriptions();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, lastMicrophoneError } = useLocalParticipant();
  const [controlError, setControlError] = useState<string>();
  const [toolEvents, setToolEvents] = useState<BrowserToolEvent[]>([]);
  const [rimeConfigured, setRimeConfigured] = useState(false);
  const [rimeSpeechObserved, setRimeSpeechObserved] = useState(false);
  const roomConnected = connectionState === ConnectionState.Connected;
  const agentReady = Boolean(agent) && !['disconnected', 'connecting', 'initializing', 'failed'].includes(agentState);
  const latestRequest = [...toolEvents].reverse().find((event) => event.status === 'started') ?? toolEvents.at(-1);
  const latestSettings = toolEvents.at(-1);

  useEffect(() => {
    const handleData = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as BrowserToolEvent | BrowserVoiceEvent;
        if (topic === 'vairynt.tool' && event.type === 'vairynt.tool') setToolEvents((current) => [...current.slice(-8), event]);
        if (topic === 'vairynt.voice' && event.type === 'vairynt.voice') {
          setRimeConfigured((current) => current || event.status === 'configured' || event.status === 'speaking');
          setRimeSpeechObserved((current) => current || event.status === 'speaking');
        }
      } catch {
        setControlError('A diagnostic event could not be decoded.');
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  async function toggleMicrophone() {
    setControlError(undefined);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (cause) {
      setControlError(cause instanceof Error ? cause.message : 'Unable to change microphone state');
    }
  }

  function exportEvidence() {
    const payload = {
      exportedAt: new Date().toISOString(), roomConnected, agentState, rimeConfigured, rimeSpeechObserved, latestRequest, toolEvents,
      transcripts: transcripts.map((item) => ({ participant: item.participantInfo.identity, text: item.text })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vairynt-session-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <section className="conversation-panel" aria-label="Voice conversation">
        <div className="panel-heading">
          <div><p className="section-label">Technician channel</p><h1>Field conversation</h1></div>
          <div className="session-state" aria-live="polite">
            <span data-ready={roomConnected}>Room {roomConnected ? 'connected' : 'connecting'}</span>
            <span data-ready={agentReady}>Agent {agentReady ? 'ready' : agentState}</span>
          </div>
        </div>
        <div className="request-strip"><span>Latest request</span><strong>{latestRequest ? `${latestRequest.identifier || 'Unclear identifier'} · ${latestRequest.tool}` : 'Awaiting technician speech'}</strong></div>
        <div className="transcript" aria-live="polite" aria-label="Live transcript">
          {transcripts.length === 0 ? <p>Transcript entries appear after speech is recognized.</p> : transcripts.slice(-12).map((item, index) => (
            <article key={`${item.participantInfo.identity}-${index}`}>
              <strong>{item.participantInfo.identity === localParticipant.identity ? 'Technician' : 'VAIRYNT'}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="session-controls" aria-label="Microphone controls">
          <button type="button" onClick={toggleMicrophone}>{isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}</button>
          <button type="button" className="end-button" onClick={() => void room.disconnect()}>End session</button>
          <StartAudio label="Enable agent audio" className="audio-unlock" />
        </div>
        {(controlError || lastMicrophoneError) && <p className="error" role="alert">{controlError ?? lastMicrophoneError?.message}</p>}
      </section>
      <aside className="diagnostics-panel" aria-label="Session diagnostics">
        <div className="panel-heading"><div><p className="section-label">Diagnostics</p><h2>Session evidence</h2></div><span className="synthetic-label">Synthetic data</span></div>
        <dl className="status-list">
          <div><dt>Rime configured</dt><dd data-ready={rimeConfigured}>{rimeConfigured ? 'confirmed' : 'awaiting worker event'}</dd></div>
          <div><dt>Rime speech activity</dt><dd data-ready={rimeSpeechObserved}>{rimeSpeechObserved ? 'reported by session' : 'not observed'}</dd></div>
          <div><dt>Latest turn</dt><dd>{latestRequest ? `#${latestRequest.epoch}` : '—'}</dd></div>
        </dl>
        <details className="diagnostics-drawer">
          <summary>Turn events and controls</summary>
          <div className="tool-feed" aria-live="polite">
            {toolEvents.length === 0 ? <p>No tool events yet.</p> : toolEvents.map((event) => (
              <div key={`${event.requestId}-${event.status}`} data-status={event.status}>
                <strong>#{event.epoch} {event.tool}</strong><span>{event.identifier || 'unclear'} · {event.status}{event.durationMs === undefined ? '' : ` · ${event.durationMs} ms`}</span>
              </div>
            ))}
          </div>
          <dl className="settings-list">
            <div><dt>Tool delay</dt><dd>{latestSettings ? `${latestSettings.delayMs} ms` : 'awaiting event'}</dd></div>
            <div><dt>Tool timeout</dt><dd>{latestSettings ? `${latestSettings.timeoutMs} ms` : 'awaiting event'}</dd></div>
            <div><dt>Stress mode</dt><dd>{latestSettings ? (latestSettings.stressMode ? 'on' : 'off') : 'awaiting event'}</dd></div>
          </dl>
          <button type="button" className="export-button" onClick={exportEvidence}>Export session evidence</button>
        </details>
      </aside>
      <RoomAudioRenderer />
    </>
  );
}

export function App() {
  const [credentials, setCredentials] = useState<Credentials>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    setError(undefined);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost.');
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
      const response = await fetch(`${webEnv.apiUrl}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error(`Token service returned ${response.status}`);
      setCredentials((await response.json()) as Credentials);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
        setError('Microphone permission was denied. Allow microphone access, then start again.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to start the voice session');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header>
        <div className="brand"><strong>VAIRYNT</strong><span>Field service</span></div>
        <div className="site">Technician voice workspace</div>
      </header>
      {credentials ? (
        <LiveKitRoom
          token={credentials.participant_token}
          serverUrl={credentials.server_url}
          connect
          audio
          video={false}
          onMediaDeviceFailure={(failure) => setError(`Microphone unavailable: ${failure}`)}
          onDisconnected={() => setCredentials(undefined)}
        >
          <div className="console-grid"><ConsoleBody /></div>
        </LiveKitRoom>
      ) : (
        <section className="launch-card" aria-label="Start a technician voice session">
          <div><p className="section-label">Session</p><h1>Start field session</h1><p>Allow microphone access to connect the technician voice channel.</p></div>
          <button onClick={connect} disabled={loading}>{loading ? 'Starting session…' : 'Start session'}</button>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      )}
      <footer>Voice interaction and diagnostics are scoped to this live room.</footer>
    </main>
  );
}
