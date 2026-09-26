import { Agent, AgentSessionEventTypes, cli, defineAgent, type JobProcess, ServerOptions, StopResponse, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import * as rime from '@livekit/agents-plugin-rime';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { isCancelCommand, RoomTurnManager } from './room-turn-manager.js';
import { createTechnicianTools } from './tools.js';
import type { ToolEvent } from './tool-service.js';

const VOICE_AGENT_NAME = env.LIVEKIT_AGENT_NAME;
const TOOL_EVENT_TOPIC = 'vairynt.tool';
const VOICE_EVENT_TOPIC = 'vairynt.voice';

export default defineAgent({
  prewarm: async (process: JobProcess) => {
    process.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx) => {
    const turns = new RoomTurnManager(ctx.room.name || ctx.job.id);
    const sendToolEvent = async (event: ToolEvent) => {
      try {
        const payload = new TextEncoder().encode(JSON.stringify(event));
        const participant = ctx.room.localParticipant;
        if (!participant) throw new Error('agent participant is not connected');
        await participant.publishData(payload, { reliable: true, topic: TOOL_EVENT_TOPIC });
      } catch {
        console.warn(JSON.stringify({ event: 'tool_event_delivery_failed', requestId: event.requestId }));
      }
    };
    const sendVoiceEvent = async (status: 'configured' | 'speaking', agentState: string) => {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ type: 'vairynt.voice', status, agentState }));
        const participant = ctx.room.localParticipant;
        if (!participant) throw new Error('agent participant is not connected');
        await participant.publishData(payload, { reliable: true, topic: VOICE_EVENT_TOPIC });
      } catch {
        console.warn(JSON.stringify({ event: 'voice_event_delivery_failed', status }));
      }
    };
    const agent = Agent.create({
      instructions: [
        'You are VAIRYNT, a concise hands-free industrial maintenance assistant.',
        'Use lookupInventory for stock, lookupPart for part details, and lookupManual for a model manual.',
        'Identifiers are strings. Never perform arithmetic on them or request the entire inventory.',
        'A correction such as “4472 instead” replaces the earlier identifier; call the tool only with the corrected value.',
        'If an identifier is missing or unclear, ask one short clarifying question before using a tool.',
        'When the technician says "cancel that", stop without calling a tool or answering the cancelled request.',
        'Answer in one or two plain spoken sentences using only the requested tool result.',
        'Say honestly when an item is unknown or a lookup times out. Never invent fixture data.',
      ].join(' '),
      tools: createTechnicianTools({
        delayMs: env.TOOL_DELAY_MS,
        timeoutMs: env.TOOL_TIMEOUT_MS,
        stressMode: env.TOOL_STRESS_MODE,
      }, turns, sendToolEvent),
      onUserTurnCompleted: (_agentContext, _chatContext, message) => {
        const epoch = turns.capture();
        turns.assertCurrent(epoch, 'generation');
        if (isCancelCommand(message.textContent ?? '')) {
          turns.cancelCurrent('cancel that');
          throw new StopResponse();
        }
      },
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: openai.STT.withGroq({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_STT_MODEL,
        language: env.RIME_LANGUAGE,
        detectLanguage: false,
      }),
      llm: new google.LLM({ apiKey: env.GOOGLE_API_KEY, model: env.GEMINI_MODEL }),
      tts: new rime.TTS({
        apiKey: env.RIME_API_KEY,
        modelId: env.RIME_MODEL,
        speaker: env.RIME_VOICE,
        lang: env.RIME_LANGUAGE,
        useWebsocket: env.RIME_USE_WEBSOCKET,
      }),
      useTtsAlignedTranscript: true,
      turnHandling: {
        turnDetection: 'vad',
        preemptiveGeneration: { enabled: false },
        interruption: {
          enabled: true,
          mode: 'vad',
          minDuration: 200,
          minWords: 0,
          discardAudioIfUninterruptible: true,
          falseInterruptionTimeout: 1_200,
          resumeFalseInterruption: false,
        },
      },
    });

    session.on(AgentSessionEventTypes.UserStateChanged, (event) => {
      const wasBusy = turns.hasInFlightTask || session.agentState === 'thinking' || session.agentState === 'speaking';
      const replacementEpoch = turns.acceptUserState(event.newState);
      if (!replacementEpoch || !wasBusy) return;
      void session.interrupt({ force: true }).await.catch(() => {
        console.warn(JSON.stringify({ event: 'voice_interrupt_failed', epoch: replacementEpoch.value }));
      });
    });
    session.on(AgentSessionEventTypes.UserInputTranscribed, (event) => {
      turns.observeTranscript(event);
    });
    session.on(AgentSessionEventTypes.AgentFalseInterruption, (event) => {
      if (!event.resumed) return;
      void session.interrupt({ force: true }).await.catch(() => undefined);
    });
    session.on(AgentSessionEventTypes.AgentStateChanged, (event) => {
      if (event.newState === 'speaking') void sendVoiceEvent('speaking', event.newState);
    });

    await session.start({ agent, room: ctx.room, outputOptions: { syncTranscription: true } });
    await sendVoiceEvent('configured', session.agentState);
    await ctx.connect();
    const greetingEpoch = turns.capture();
    turns.assertCurrent(greetingEpoch, 'greeting generation');
    const greeting = session.generateReply({ instructions: 'Introduce VAIRYNT in one sentence and ask for a part or model identifier.' });
    if (!turns.isCurrent(greetingEpoch)) greeting.interrupt(true);
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: VOICE_AGENT_NAME }));
