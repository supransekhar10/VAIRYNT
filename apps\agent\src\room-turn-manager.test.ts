import { describe, expect, it } from 'vitest';
import { StaleResultError } from '@vairynt/core';
import { RoomTurnManager } from './room-turn-manager.js';

const pause = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

describe('room turn manager', () => {
  it('fences a late result even when work ignores cancellation', async () => {
    const turns = new RoomTurnManager('room-a');
    const oldEpoch = turns.capture();
    const lateWork = (async () => {
      await pause(10);
      turns.assertCurrent(oldEpoch, 'late tool');
      return 'old payload';
    })();

    turns.acceptUserState('speaking');
    await expect(lateWork).rejects.toBeInstanceOf(StaleResultError);
  });

  it('creates one epoch per accepted speech start across rapid corrections', () => {
    const turns = new RoomTurnManager('room-a');
    const first = turns.acceptUserState('speaking');
    expect(turns.acceptUserState('speaking')).toBeUndefined();
    const partial = turns.observeTranscript({ itemId: 'first', transcript: '4471', isFinal: false });
    const duplicate = turns.observeTranscript({ itemId: 'first', transcript: '4471', isFinal: false });
    turns.acceptUserState('listening');
    const second = turns.acceptUserState('speaking');
    turns.acceptUserState('listening');
    const third = turns.acceptUserState('speaking');
    const final = turns.observeTranscript({ itemId: 'third', transcript: '4473 instead', isFinal: true });

    expect([first?.value, second?.value, third?.value]).toEqual([1, 2, 3]);
    expect(partial.epoch.value).toBe(1);
    expect(duplicate.duplicate).toBe(true);
    expect(final.epoch.value).toBe(3);
  });

  it('isolates epochs and cancellation between rooms', () => {
    const roomA = new RoomTurnManager('room-a');
    const roomB = new RoomTurnManager('room-b');
    const roomBEpoch = roomB.capture();

    roomA.acceptUserState('speaking');
    expect(roomA.capture().value).toBe(1);
    expect(roomB.isCurrent(roomBEpoch)).toBe(true);
    expect(roomB.capture().value).toBe(0);
  });

  it('deduplicates cancel-that partial and final updates', () => {
    const turns = new RoomTurnManager('room-a');
    turns.acceptUserState('speaking');
    const partial = turns.observeTranscript({ itemId: 'cancel', transcript: 'cancel that', isFinal: false });
    const final = turns.observeTranscript({ itemId: 'cancel', transcript: 'cancel that', isFinal: true });

    expect(partial.cancelRequested).toBe(true);
    expect(final.cancelRequested).toBe(false);
    expect(turns.capture().value).toBe(1);
  });
});
