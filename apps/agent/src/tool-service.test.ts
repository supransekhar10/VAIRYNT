import { describe, expect, it } from 'vitest';
import { StaleResultError } from '@vairynt/core';
import { RoomTurnManager } from './room-turn-manager.js';
import { createLookupService, type ToolEvent } from './tool-service.js';

const activeSignal = () => new AbortController().signal;
const serviceFor = (settings: { delayMs: number; timeoutMs: number; stressMode: boolean }, sendEvent?: (event: ToolEvent) => void) => {
  const turns = new RoomTurnManager('test-room');
  return { turns, service: createLookupService(settings, turns, sendEvent) };
};

describe('synthetic asynchronous lookups', () => {
  it('returns only the requested known inventory items as string IDs', async () => {
    const { service } = serviceFor({ delayMs: 1, timeoutMs: 100, stressMode: false });
    await expect(service.lookupInventory('4471', activeSignal())).resolves.toEqual({
      status: 'found', item: { partId: '4471', units: 3, shelf: 'A2' },
    });
    await expect(service.lookupInventory('4472', activeSignal())).resolves.toEqual({
      status: 'found', item: { partId: '4472', units: 12, shelf: 'B4' },
    });
    await expect(service.lookupInventory('4473', activeSignal())).resolves.toEqual({
      status: 'found', item: { partId: '4473', units: 0 },
    });
  });

  it('reports an unknown part without exposing other records', async () => {
    const { service } = serviceFor({ delayMs: 1, timeoutMs: 100, stressMode: false });
    const result = await service.lookupPart('9999', activeSignal());
    expect(result).toMatchObject({ status: 'unknown', identifier: '9999' });
    expect(JSON.stringify(result)).not.toContain('4471');
  });

  it('uses the latest part ID in a spoken correction', async () => {
    const { service } = serviceFor({ delayMs: 1, timeoutMs: 100, stressMode: false });
    await expect(service.lookupInventory('4471, no, 4472 instead', activeSignal())).resolves.toMatchObject({
      status: 'found', item: { partId: '4472', units: 12, shelf: 'B4' },
    });
    await expect(service.lookupInventory('4471 or 4472', activeSignal())).resolves.toMatchObject({ status: 'unclear' });
  });

  it('returns the synthetic X220 manual entry', async () => {
    const { service } = serviceFor({ delayMs: 1, timeoutMs: 100, stressMode: false });
    await expect(service.lookupManual('x220', activeSignal())).resolves.toMatchObject({
      status: 'found', item: { modelId: 'X220', title: 'Synthetic X220 service manual' },
    });
  });

  it('reports a configurable timeout honestly', async () => {
    const { service } = serviceFor({ delayMs: 30, timeoutMs: 5, stressMode: false });
    await expect(service.lookupInventory('4471', activeSignal())).resolves.toMatchObject({
      status: 'timeout', identifier: '4471', message: 'lookupInventory timed out.',
    });
  });

  it('labels stress mode and fences deliberately uncancellable old work', async () => {
    const events: ToolEvent[] = [];
    const { service, turns } = serviceFor({ delayMs: 20, timeoutMs: 100, stressMode: true }, (event) => {
      events.push(event);
    });
    const oldWork = service.lookupInventory('4471', activeSignal());
    await new Promise((resolve) => setTimeout(resolve, 2));
    turns.acceptUserState('speaking');
    await expect(oldWork).rejects.toBeInstanceOf(StaleResultError);
    expect(events.at(-1)).toMatchObject({ status: 'stale', stressMode: true });
  });

  it('allows only the newest result through rapid 4471 to 4472 to 4473 corrections', async () => {
    const { service, turns } = serviceFor({ delayMs: 15, timeoutMs: 100, stressMode: true });
    turns.acceptUserState('speaking');
    const first = service.lookupInventory('4471', activeSignal());
    turns.acceptUserState('listening');
    turns.acceptUserState('speaking');
    const second = service.lookupInventory('4472 instead', activeSignal());
    turns.acceptUserState('listening');
    turns.acceptUserState('speaking');
    const third = service.lookupInventory('4473 instead', activeSignal());

    await expect(first).rejects.toBeInstanceOf(StaleResultError);
    await expect(second).rejects.toBeInstanceOf(StaleResultError);
    await expect(third).resolves.toEqual({ status: 'found', item: { partId: '4473', units: 0 } });
  });
});
