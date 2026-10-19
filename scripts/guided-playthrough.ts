import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  act, available, createGame, rates, requirements, tick,
  type Action,
} from '../src/game/index.ts';
import { getLearningJourney } from '../src/progression.ts';

/** Follow the visible learning path, without a second hidden purchasing policy. */
export function runGuidedJourney(maxSeconds = 45 * 60, verbose = true) {
  let state = createGame(0);
  let purchases = 0;
  let recoveries = 0;
  let previousStep = '';
  const boughtAt: Record<string, number> = {};
  const steps: Array<{ id: string; name: string; seconds: number }> = [];

  const dispatch = (action: Action) => {
    const next = act(state, action);
    if (next === state) return false;
    state = next;
    if (action.type === 'buy') {
      purchases++;
      boughtAt[action.id] ??= state.elapsed;
    } else if (action.type === 'restore' || action.type === 'stabilize') recoveries++;
    return true;
  };

  for (let second = 0; second < maxSeconds && !state.completed; second++) {
    const { current } = getLearningJourney(state);
    if (current.id !== previousStep) {
      previousStep = current.id;
      steps.push({ id: current.id, name: current.name, seconds: state.elapsed });
      if (verbose) console.log(`${(state.elapsed / 60).toFixed(1)}m · ${current.name}`);
    }

    // One tap per second in the first minute is the only manual income policy.
    if (second < 60) dispatch({ type: 'gather' });

    if (current.kind === 'purchase' && current.actionId && available(state, current.actionId)) {
      dispatch({ type: 'buy', id: current.actionId });
    } else if (current.action && current.action.type !== 'gather') {
      // A free recovery or nursery switch is performed only when the guide offers it.
      dispatch(current.action);
    }
    state = tick(state, 1);
    for (const [id, amount] of Object.entries(state.resources)) {
      assert(Number.isFinite(amount) && amount >= 0, `Invalid ${id} at ${second}s: ${amount}`);
    }
  }

  const current = getLearningJourney(state).current;
  const summary = {
    completed: state.completed,
    minutes: Math.round(state.elapsed / 6) / 10,
    firstAutomationSeconds: boughtAt.collector,
    lifeMinutes: boughtAt.abiogenesis === undefined ? null : Math.round(boughtAt.abiogenesis / 6) / 10,
    humansMinutes: boughtAt.humans === undefined ? null : Math.round(boughtAt.humans / 6) / 10,
    spaceAgeMinutes: boughtAt.spaceflight === undefined ? null : Math.round(boughtAt.spaceflight / 6) / 10,
    health: Math.round(state.health),
    purchases,
    recoveries,
    suggestedStepsVisited: steps.length,
    manualTaps: state.stats.taps,
    ...(!state.completed ? {
      current,
      missing: current.actionId ? requirements(state, current.actionId) : current.missing,
      rates: rates(state),
      resources: state.resources,
      buildings: state.buildings,
      upgrades: state.upgrades,
    } : {}),
  };
  if (verbose || !state.completed) console.log(JSON.stringify(summary, null, 2));

  assert(state.completed, `The guided fresh game did not complete within ${maxSeconds / 60} minutes`);
  assert(state.health >= 60, 'Guided completion must preserve at least 60% biosphere health');
  assert(state.upgrades.spaceflight && state.upgrades.observatory, 'Guided completion needs Space Age and observatory');
  assert((boughtAt.collector ?? Infinity) <= 60, 'Guided first automation should be available within about one minute');
  assert(boughtAt.abiogenesis >= 7.5 * 60 && boughtAt.abiogenesis <= 12.5 * 60,
    'The guided route should reach life in about 8–12 minutes');
  assert(state.elapsed >= 30 * 60 && state.elapsed <= 45 * 60,
    'The guided route should complete in about 30–45 minutes');
  assert(state.stats.taps <= 60, 'The guided route must not depend on continued manual hydrogen gathering');
  return { state, purchases, boughtAt, steps, summary };
}

if (process.argv[1]?.endsWith('guided-playthrough.ts')) {
  const { state, steps, summary } = runGuidedJourney();
  const statePath = process.env.GUIDED_STATE_PATH;
  if (statePath) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    writeFileSync(statePath.replace(/\.json$/, '') + '.report.json', JSON.stringify({ summary, steps }, null, 2));
    console.log(`Guided completed game state exported to ${statePath}`);
  }
}
