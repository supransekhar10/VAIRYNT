import { describe, expect, it } from 'vitest';
import { StaleResultError, TurnCoordinator } from './index.js';

describe('TurnCoordinator', () => {
  it('aborts work when a newer turn starts', async () => {
    const coordinator = new TurnCoordinator();
    const first = coordinator.beginTurn();
    const work = coordinator.run(first, 'inventory', (signal) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    );
    coordinator.beginTurn();
    await expect(work).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fences a result belonging to a superseded turn', async () => {
    const coordinator = new TurnCoordinator();
    const first = coordinator.beginTurn();
    let finish!: (value: string) => void;
    const work = coordinator.run(first, 'manual', () => new Promise<string>((resolve) => (finish = resolve)));
    coordinator.beginTurn();
    finish('late result');
    await expect(work).rejects.toBeInstanceOf(StaleResultError);
  });
});
