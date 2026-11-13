export type OperationEvidence = {
  turnId: number;
  operationId: string;
  name: string;
  durationMs: number;
  outcome: 'completed' | 'cancelled' | 'stale' | 'failed';
};

export class StaleResultError extends Error {
  constructor(readonly turnId: number) {
    super(`Result for superseded turn ${turnId} was fenced`);
    this.name = 'StaleResultError';
  }
}

export class TurnCoordinator {
  #currentTurnId = 0;
  #sequence = 0;
  #operations = new Map<string, AbortController>();

  constructor(private readonly record: (evidence: OperationEvidence) => void = () => undefined) {}

  get currentTurnId() {
    return this.#currentTurnId;
  }

  beginTurn() {
    this.cancelActive('superseded');
    return ++this.#currentTurnId;
  }

  cancelActive(reason = 'cancelled') {
    for (const controller of this.#operations.values()) controller.abort(reason);
    this.#operations.clear();
  }

  async run<T>(turnId: number, name: string, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (turnId !== this.#currentTurnId) throw new StaleResultError(turnId);
    const operationId = `${turnId}:${++this.#sequence}`;
    const controller = new AbortController();
    const startedAt = performance.now();
    this.#operations.set(operationId, controller);

    try {
      const result = await work(controller.signal);
      if (turnId !== this.#currentTurnId) {
        this.#record(turnId, operationId, name, startedAt, 'stale');
        throw new StaleResultError(turnId);
      }
      this.#record(turnId, operationId, name, startedAt, 'completed');
      return result;
    } catch (error) {
      if (!(error instanceof StaleResultError)) {
        this.#record(turnId, operationId, name, startedAt, controller.signal.aborted ? 'cancelled' : 'failed');
      }
      throw error;
    } finally {
      this.#operations.delete(operationId);
    }
  }

  #record(
    turnId: number,
    operationId: string,
    name: string,
    startedAt: number,
    outcome: OperationEvidence['outcome'],
  ) {
    this.record({ turnId, operationId, name, durationMs: Math.round(performance.now() - startedAt), outcome });
  }
}

export function abortableDelay(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Operation aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
