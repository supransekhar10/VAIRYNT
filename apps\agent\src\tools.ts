import { llm } from '@livekit/agents';
import { z } from 'zod';
import { createLookupService, type LookupSettings, type ToolEvent } from './tool-service.js';
import type { RoomTurnManager } from './room-turn-manager.js';

export function createTechnicianTools(settings: LookupSettings, turns: RoomTurnManager, sendEvent: (event: ToolEvent) => void | Promise<void>) {
  const service = createLookupService(settings, turns, sendEvent);
  const partId = z.string().describe('Exact part ID as digits only, preserving leading zeroes.');
  const modelId = z.string().describe('Exact equipment model ID, such as X220.');

  return [
    llm.tool({
      name: 'lookupInventory',
      description: 'Look up one part ID in the labelled synthetic inventory fixture. Never request all inventory.',
      flags: llm.ToolFlag.CANCELLABLE,
      onDuplicate: 'replace',
      parameters: z.object({ partId }),
      execute: ({ partId: id }, { abortSignal }) => service.lookupInventory(id, abortSignal),
    }),
    llm.tool({
      name: 'lookupPart',
      description: 'Look up one part ID in the labelled synthetic part fixture.',
      flags: llm.ToolFlag.CANCELLABLE,
      onDuplicate: 'replace',
      parameters: z.object({ partId }),
      execute: ({ partId: id }, { abortSignal }) => service.lookupPart(id, abortSignal),
    }),
    llm.tool({
      name: 'lookupManual',
      description: 'Look up one model ID in the labelled synthetic manual fixture.',
      flags: llm.ToolFlag.CANCELLABLE,
      onDuplicate: 'replace',
      parameters: z.object({ modelId }),
      execute: ({ modelId: id }, { abortSignal }) => service.lookupManual(id, abortSignal),
    }),
  ];
}
