import { StaleResultError } from '@vairynt/core';
import inventoryFixture from './fixtures/inventory.json' with { type: 'json' };
import manualFixture from './fixtures/manuals.json' with { type: 'json' };
import partFixture from './fixtures/parts.json' with { type: 'json' };
import type { RoomTurnManager } from './room-turn-manager.js';

export type ToolName = 'lookupInventory' | 'lookupPart' | 'lookupManual';
export type ToolEventStatus = 'started' | 'found' | 'unknown' | 'unclear' | 'timeout' | 'cancelled' | 'stale';
export type ToolEvent = {
  type: 'vairynt.tool';
  tool: ToolName;
  requestId: string;
  identifier: string;
  status: ToolEventStatus;
  epoch: number;
  durationMs?: number;
  delayMs: number;
  timeoutMs: number;
  stressMode: boolean;
};
export type LookupSettings = { delayMs: number; timeoutMs: number; stressMode: boolean };
export type LookupResult<T> =
  | { status: 'found'; item: T }
  | { status: 'unknown' | 'unclear' | 'timeout'; identifier: string; message: string };

type InventoryItem = (typeof inventoryFixture.items)[keyof typeof inventoryFixture.items];
type PartItem = (typeof partFixture.items)[keyof typeof partFixture.items];
type ManualItem = (typeof manualFixture.items)[keyof typeof manualFixture.items];
type EventSink = (event: ToolEvent) => void | Promise<void>;

const wait = (durationMs: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, durationMs);
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(signal.reason);
  }, { once: true });
});

export function createLookupService(settings: LookupSettings, turns: RoomTurnManager, sendEvent: EventSink = () => undefined) {
  let sequence = 0;

  async function emit(event: Omit<ToolEvent, 'delayMs' | 'timeoutMs'>) {
    await sendEvent({ ...event, delayMs: settings.delayMs, timeoutMs: settings.timeoutMs });
  }

  async function lookup<T>(
    tool: ToolName,
    identifier: string,
    signal: AbortSignal,
    normalize: (value: string) => string | undefined,
    find: (value: string) => T | undefined,
  ): Promise<LookupResult<T>> {
    const epoch = turns.capture();
    const finishTask = turns.startTask(epoch);
    const normalized = normalize(identifier) ?? identifier.trim().toUpperCase();
    const requestId = `${Date.now()}-${++sequence}`;
    const startedAt = performance.now();
    if (!normalize(identifier)) {
      try {
        await emit({ type: 'vairynt.tool', tool, requestId, identifier: normalized, status: 'unclear', epoch: epoch.value, stressMode: settings.stressMode });
        turns.assertCurrent(epoch, tool);
        return { status: 'unclear', identifier: normalized, message: 'The identifier is unclear. Ask the technician to repeat it.' };
      } finally {
        finishTask();
      }
    }

    try {
      await emit({ type: 'vairynt.tool', tool, requestId, identifier: normalized, status: 'started', epoch: epoch.value, stressMode: settings.stressMode });
      turns.assertCurrent(epoch, tool);
      const timeoutSignal = AbortSignal.timeout(settings.timeoutMs);
      const delaySignal = settings.stressMode ? timeoutSignal : AbortSignal.any([epoch.signal, signal, timeoutSignal]);
      await wait(settings.delayMs, delaySignal);
      turns.assertCurrent(epoch, tool);
      const result = find(normalized);
      const status = result ? 'found' : 'unknown';
      await emit({ type: 'vairynt.tool', tool, requestId, identifier: normalized, status, epoch: epoch.value, durationMs: Math.round(performance.now() - startedAt), stressMode: settings.stressMode });
      turns.assertCurrent(epoch, tool);
      return result
        ? { status: 'found', item: result }
        : { status: 'unknown', identifier: normalized, message: `No synthetic fixture entry exists for ${normalized}.` };
    } catch (error) {
      const status: ToolEventStatus = error instanceof StaleResultError || !turns.isCurrent(epoch) ? 'stale'
        : error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout'
          : 'cancelled';
      await emit({ type: 'vairynt.tool', tool, requestId, identifier: normalized, status, epoch: epoch.value, durationMs: Math.round(performance.now() - startedAt), stressMode: settings.stressMode });
      if (status === 'timeout') {
        turns.assertCurrent(epoch, tool);
        return { status: 'timeout', identifier: normalized, message: `${tool} timed out.` };
      }
      if (status === 'stale' && !(error instanceof StaleResultError)) throw new StaleResultError(epoch.value);
      throw error;
    } finally {
      finishTask();
    }
  }

  return {
    lookupInventory: (partId: string, signal: AbortSignal) => lookup<InventoryItem>(
      'lookupInventory', partId, signal, normalizePartId,
      (value) => inventoryFixture.items[value as keyof typeof inventoryFixture.items],
    ),
    lookupPart: (partId: string, signal: AbortSignal) => lookup<PartItem>(
      'lookupPart', partId, signal, normalizePartId,
      (value) => partFixture.items[value as keyof typeof partFixture.items],
    ),
    lookupManual: (modelId: string, signal: AbortSignal) => lookup<ManualItem>(
      'lookupManual', modelId, signal, normalizeModelId,
      (value) => manualFixture.items[value as keyof typeof manualFixture.items],
    ),
  };
}

function normalizePartId(value: string) {
  const matches = value.match(/\b\d{4}\b/g) ?? [];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1 && /\b(instead|rather|correction)\b/i.test(value)) return matches.at(-1);
  return /^\d{4}$/.test(value.trim()) ? value.trim() : undefined;
}

function normalizeModelId(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]\d{3}$/.test(compact) ? compact : undefined;
}
