import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaleResultError } from '@vairynt/core';
import { RoomTurnManager } from './room-turn-manager.js';
import { createLookupService, type LookupResult, type ToolEvent } from './tool-service.js';

const TOOL_DELAY_MS = 2_000;
const CORRECTION_AT_MS = 800;
const OUTPUT_DIRECTORY = fileURLToPath(new URL('../../../evidence/', import.meta.url));
const activeSignal = () => new AbortController().signal;
const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

type Outcome = { kind: 'resolved'; value: LookupResult<unknown> } | { kind: 'rejected'; name: string };
type Trial = {
  id: string;
  scenario: 'ignored-cancellation' | 'rapid-corrections' | 'explicit-cancel' | 'timeout' | 'room-isolation';
  scheduled: { toolDelayMs: number; correctionAtMs: number | null; timeoutMs: number; stressMode: boolean };
  elapsedMs: number;
  passed: boolean;
  outcomes: Record<string, Outcome | number | boolean>;
  events: ToolEvent[];
};

const settle = async (promise: Promise<LookupResult<unknown>>): Promise<Outcome> => {
  try {
    return { kind: 'resolved', value: await promise };
  } catch (error) {
    return { kind: 'rejected', name: error instanceof Error ? error.name : 'UnknownError' };
  }
};

const isStale = (outcome: Outcome) => outcome.kind === 'rejected' && outcome.name === StaleResultError.name;
const isFound = (outcome: Outcome, partId: string) => outcome.kind === 'resolved'
  && outcome.value.status === 'found'
  && (outcome.value.item as { partId?: string }).partId === partId;

function harness(roomId: string, timeoutMs = 5_000, stressMode = true) {
  const turns = new RoomTurnManager(roomId);
  const events: ToolEvent[] = [];
  const service = createLookupService({ delayMs: TOOL_DELAY_MS, timeoutMs, stressMode }, turns, (event) => {
    events.push(event);
  });
  return { turns, events, service };
}

async function ignoredCancellation(id: string): Promise<Trial> {
  const startedAt = performance.now();
  const { turns, events, service } = harness(`ignored-${id}`);
  const old = service.lookupInventory('4471', activeSignal());
  await sleep(CORRECTION_AT_MS);
  turns.acceptUserState('speaking');
  const replacement = service.lookupInventory('4472 instead', activeSignal());
  const [oldOutcome, replacementOutcome] = await Promise.all([settle(old), settle(replacement)]);
  return {
    id, scenario: 'ignored-cancellation',
    scheduled: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: CORRECTION_AT_MS, timeoutMs: 5_000, stressMode: true },
    elapsedMs: Math.round(performance.now() - startedAt),
    passed: isStale(oldOutcome) && isFound(replacementOutcome, '4472'),
    outcomes: { old: oldOutcome, replacement: replacementOutcome, finalEpoch: turns.capture().value }, events,
  };
}

async function rapidCorrections(id: string): Promise<Trial> {
  const startedAt = performance.now();
  const { turns, events, service } = harness(`rapid-${id}`);
  const first = service.lookupInventory('4471', activeSignal());
  await sleep(CORRECTION_AT_MS);
  turns.acceptUserState('speaking');
  const second = service.lookupInventory('4472 instead', activeSignal());
  await sleep(CORRECTION_AT_MS);
  turns.acceptUserState('listening');
  turns.acceptUserState('speaking');
  const third = service.lookupInventory('4473 instead', activeSignal());
  const [firstOutcome, secondOutcome, thirdOutcome] = await Promise.all([settle(first), settle(second), settle(third)]);
  return {
    id, scenario: 'rapid-corrections',
    scheduled: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: CORRECTION_AT_MS, timeoutMs: 5_000, stressMode: true },
    elapsedMs: Math.round(performance.now() - startedAt),
    passed: isStale(firstOutcome) && isStale(secondOutcome) && isFound(thirdOutcome, '4473'),
    outcomes: { first: firstOutcome, second: secondOutcome, third: thirdOutcome, finalEpoch: turns.capture().value }, events,
  };
}

async function explicitCancel(id: string): Promise<Trial> {
  const startedAt = performance.now();
  const { turns, events, service } = harness(`cancel-${id}`);
  const old = service.lookupInventory('4471', activeSignal());
  await sleep(CORRECTION_AT_MS);
  turns.acceptUserState('speaking');
  turns.cancelCurrent('cancel that');
  const oldOutcome = await settle(old);
  return {
    id, scenario: 'explicit-cancel',
    scheduled: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: CORRECTION_AT_MS, timeoutMs: 5_000, stressMode: true },
    elapsedMs: Math.round(performance.now() - startedAt),
    passed: isStale(oldOutcome) && turns.capture().value === 2,
    outcomes: { old: oldOutcome, finalEpoch: turns.capture().value }, events,
  };
}

async function timeout(id: string): Promise<Trial> {
  const startedAt = performance.now();
  const { events, service } = harness(`timeout-${id}`, 25, false);
  const result = await settle(service.lookupInventory('4471', activeSignal()));
  return {
    id, scenario: 'timeout',
    scheduled: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: null, timeoutMs: 25, stressMode: false },
    elapsedMs: Math.round(performance.now() - startedAt),
    passed: result.kind === 'resolved' && result.value.status === 'timeout',
    outcomes: { result }, events,
  };
}

async function roomIsolation(id: string): Promise<Trial> {
  const startedAt = performance.now();
  const roomA = harness(`isolation-a-${id}`);
  const roomB = harness(`isolation-b-${id}`);
  const oldA = roomA.service.lookupInventory('4471', activeSignal());
  const currentB = roomB.service.lookupInventory('4472', activeSignal());
  await sleep(CORRECTION_AT_MS);
  roomA.turns.acceptUserState('speaking');
  const [oldAOutcome, currentBOutcome] = await Promise.all([settle(oldA), settle(currentB)]);
  return {
    id, scenario: 'room-isolation',
    scheduled: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: CORRECTION_AT_MS, timeoutMs: 5_000, stressMode: true },
    elapsedMs: Math.round(performance.now() - startedAt),
    passed: isStale(oldAOutcome) && isFound(currentBOutcome, '4472') && roomB.turns.capture().value === 0,
    outcomes: { roomAOld: oldAOutcome, roomBCurrent: currentBOutcome, roomBEpoch: roomB.turns.capture().value },
    events: [...roomA.events, ...roomB.events],
  };
}

const trials = [
  ...Array.from({ length: 8 }, (_, index) => () => ignoredCancellation(`ignored-${index + 1}`)),
  ...Array.from({ length: 4 }, (_, index) => () => rapidCorrections(`rapid-${index + 1}`)),
  ...Array.from({ length: 4 }, (_, index) => () => explicitCancel(`cancel-${index + 1}`)),
  ...Array.from({ length: 2 }, (_, index) => () => timeout(`timeout-${index + 1}`)),
  ...Array.from({ length: 2 }, (_, index) => () => roomIsolation(`isolation-${index + 1}`)),
];

const results: Trial[] = [];
for (const run of trials) results.push(await run());

const summary = {
  schemaVersion: 1,
  scope: 'Provider-free state fencing only; elapsed values are local test durations, not audible interruption measurements.',
  generatedAt: new Date().toISOString(),
  configuration: { toolDelayMs: TOOL_DELAY_MS, correctionAtMs: CORRECTION_AT_MS, trialCount: trials.length },
  passed: results.filter((trial) => trial.passed).length,
  failed: results.filter((trial) => !trial.passed).map((trial) => trial.id),
  byScenario: Object.fromEntries([...new Set(results.map((trial) => trial.scenario))].map((scenario) => [
    scenario,
    { total: results.filter((trial) => trial.scenario === scenario).length, passed: results.filter((trial) => trial.scenario === scenario && trial.passed).length },
  ])),
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await Promise.all([
  writeFile(join(OUTPUT_DIRECTORY, 'fencing-benchmark.raw.json'), `${JSON.stringify(results, null, 2)}\n`),
  writeFile(join(OUTPUT_DIRECTORY, 'fencing-benchmark.results.json'), `${JSON.stringify(summary, null, 2)}\n`),
]);

if (summary.failed.length) process.exitCode = 1;
