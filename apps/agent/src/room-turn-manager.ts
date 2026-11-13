import { StaleResultError } from '@vairynt/core';

export type TurnEpoch = Readonly<{
  roomId: string;
  value: number;
  signal: AbortSignal;
}>;

export type TranscriptObservation = Readonly<{
  epoch: TurnEpoch;
  duplicate: boolean;
  stale: boolean;
  cancelRequested: boolean;
}>;

type TranscriptRecord = {
  epoch: TurnEpoch;
  fingerprint: string;
  cancelHandled: boolean;
};

const isCancelCommand = (text: string) => /^\s*cancel\s+(?:that|it)\b/i.test(text);

export class RoomTurnManager {
  readonly roomId: string;
  #value = 0;
  #controller = new AbortController();
  #userSpeaking = false;
  #speechSequence = 0;
  #activeTasks = 0;
  #transcripts = new Map<string, TranscriptRecord>();

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  capture(): TurnEpoch {
    return Object.freeze({ roomId: this.roomId, value: this.#value, signal: this.#controller.signal });
  }

  get hasInFlightTask() {
    return this.#activeTasks > 0;
  }

  acceptUserState(state: 'speaking' | 'listening' | 'away'): TurnEpoch | undefined {
    if (state !== 'speaking') {
      this.#userSpeaking = false;
      return undefined;
    }
    if (this.#userSpeaking) return undefined;
    this.#userSpeaking = true;
    this.#speechSequence += 1;
    return this.#advance('accepted user speech');
  }

  observeTranscript(input: { itemId: string | null; transcript: string; isFinal: boolean }): TranscriptObservation {
    const key = input.itemId ?? `speech:${this.#speechSequence}`;
    const current = this.capture();
    const existing = this.#transcripts.get(key);
    const epoch = existing?.epoch ?? current;
    const fingerprint = `${input.isFinal ? 'final' : 'partial'}:${input.transcript.trim().toLowerCase()}`;
    const duplicate = existing?.fingerprint === fingerprint;
    const cancelRequested = !existing?.cancelHandled && this.isCurrent(epoch) && isCancelCommand(input.transcript);
    this.#transcripts.set(key, {
      epoch,
      fingerprint,
      cancelHandled: existing?.cancelHandled === true || cancelRequested,
    });
    return Object.freeze({ epoch, duplicate, stale: !this.isCurrent(epoch), cancelRequested });
  }

  cancelCurrent(reason = 'cancelled by user'): TurnEpoch {
    return this.#advance(reason);
  }

  isCurrent(epoch: TurnEpoch) {
    return epoch.roomId === this.roomId && epoch.value === this.#value && !epoch.signal.aborted;
  }

  assertCurrent(epoch: TurnEpoch, _operation = 'turn') {
    if (!this.isCurrent(epoch)) throw new StaleResultError(epoch.value);
  }

  startTask(epoch: TurnEpoch) {
    this.assertCurrent(epoch, 'tool');
    this.#activeTasks += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      if (this.isCurrent(epoch)) this.#activeTasks = Math.max(0, this.#activeTasks - 1);
    };
  }

  #advance(reason: string): TurnEpoch {
    this.#controller.abort(new Error(reason));
    this.#value += 1;
    this.#controller = new AbortController();
    this.#activeTasks = 0;
    return this.capture();
  }
}

export { isCancelCommand };
