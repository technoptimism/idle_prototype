import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  act, available, COSMIC_PROJECT_IDS, createGame, pending, tick,
} from '../src/game/index.ts';

/** A repeatable active-player policy: no presets, resource grants, or direct state edits. */
export function runJourney(maxSeconds = 45 * 60, verbose = true) {
  let state = createGame(0);
  let purchases = 0;
  const boughtAt: Record<string, number> = {};
  const buy = (id: string) => {
    if (!available(state, id)) return false;
    const next = act(state, { type: 'buy', id });
    if (next === state) return false;
    state = next;
    purchases++;
    boughtAt[id] ??= state.elapsed;
    return true;
  };
  const ensure = (id: string, target: number) => {
    const count = state.buildings[id] ?? state.upgrades[id] ?? 0;
    return count < target && buy(id);
  };
  const stellar = () => {
    if (ensure('collector', state.phase ? 10 : 6)) return true;
    if (ensure('collection', state.phase ? 2 : 1)) return true;
    if (!(state.buildings.stableStar ?? 0)) {
      if (!pending(state, 'stableStar')) {
        if (!(state.buildings.cloud ?? 0) && buy('cloud')) return true;
        if (buy('stableStar')) return true;
      }
    }
    if (!(state.buildings.planet ?? 0)) {
      if (state.stats.supernovae > 0 && buy('planet')) return true;
      if ((state.buildings.stableStar ?? 0) && !state.stars.length && !pending(state, 'massiveStar')) {
        if (!(state.buildings.cloud ?? 0) && buy('cloud')) return true;
        if (buy('massiveStar')) return true;
      }
    }
    if (state.buildings.planet) {
      for (const id of COSMIC_PROJECT_IDS) if (ensure(id, 1)) return true;
    }
    if (state.upgrades.planetOceans && ensure('stellarAutomation', 1)) return true;
    if (state.upgrades.stellarAutomation && !state.automation) {
      state = act(state, { type: 'automation', enabled: true });
      return true;
    }
    if (state.phase > 0) {
      if (ensure('pond', 3)) return true;
      if (ensure('fusion', 1)) return true;
      if ((state.buildings.stableStar ?? 0) + pending(state, 'stableStar') < 2) {
        if (!(state.buildings.cloud ?? 0) && buy('cloud')) return true;
        if (buy('stableStar')) return true;
      }
    }
    return false;
  };
  const biology = () => {
    if (ensure('colony', 3)) return true;
    if (ensure('photosynthesis', 1)) return true;
    if (ensure('producer', 8)) return true;
    if (ensure('colony', 7)) return true;
    if (ensure('metabolism', 3)) return true;
    if (ensure('reproduction', 3)) return true;
    if (ensure('population', 3)) return true;
    for (const id of ['eukaryotes', 'multicellular', 'animals', 'vertebrates', 'land', 'mammals', 'primates', 'humans']) {
      if (ensure(id, 1)) return true;
    }
    return false;
  };
  const civilization = () => {
    if (ensure('workshop', 5)) return true;
    if (ensure('agriculture', 1)) return true;
    if (ensure('farm', 4)) return true;
    if (ensure('house', 4)) return true;
    if (ensure('writing', 1)) return true;
    if (ensure('school', 5)) return true;
    if (ensure('restoration', 3)) return true;
    if (ensure('conservation', 1)) return true;
    if (ensure('industry', 1)) return true;
    if (ensure('power', 4)) return true;
    if (ensure('electricity', 1)) return true;
    if (ensure('cleanEnergy', 1)) return true;
    if (ensure('computing', 1)) return true;
    if (ensure('spaceflight', 1)) return true;
    if (ensure('observatory', 1)) return true;
    return false;
  };

  for (let seconds = 0; seconds < maxSeconds && !state.completed; seconds++) {
    // One tap a second for the first minute makes the first collector accessible in 15s.
    if (seconds < 60) state = act(state, { type: 'gather' });
    // A player can always repair habitat for free; this is used only in ecological distress.
    if (state.phase > 0 && state.health < 65) state = act(state, { type: 'restore' });
    if (state.phase === 0) {
      if (!buy('abiogenesis')) stellar();
    } else if (state.phase === 1) {
      // Keep cosmic inputs available, then grow the biosphere.
      if (!stellar()) biology();
    } else if (!civilization()) {
      stellar();
    }
    state = tick(state, 1);
    for (const [id, amount] of Object.entries(state.resources)) {
      assert(Number.isFinite(amount) && amount >= 0, `Invalid ${id} at ${seconds}s: ${amount}`);
    }
    if (verbose && seconds % 600 === 0) {
      console.log(`${Math.floor(seconds / 60)}m · phase ${state.phase + 1} · ${state.history.at(-1)?.name ?? 'Gathering hydrogen'}`);
    }
  }
  if (verbose) {
    console.log(JSON.stringify({
      completed: state.completed,
      minutes: Math.round(state.elapsed / 6) / 10,
      firstAutomationSeconds: boughtAt.collector,
      lifeMinutes: Math.round((boughtAt.abiogenesis ?? 0) / 6) / 10,
      humansMinutes: Math.round((boughtAt.humans ?? 0) / 6) / 10,
      spaceAgeMinutes: Math.round((boughtAt.spaceflight ?? 0) / 6) / 10,
      health: Math.round(state.health),
      purchases,
      ...(!state.completed ? { resources: state.resources, buildings: state.buildings, upgrades: state.upgrades } : {}),
    }, null, 2));
  }
  assert(state.completed, `A fresh normal game did not complete within ${maxSeconds / 60} minutes`);
  assert(state.health >= 60, 'Completion must preserve at least 60% biosphere health');
  assert(state.upgrades.spaceflight && state.upgrades.observatory, 'Completion needs Space Age and observatory');
  assert((boughtAt.collector ?? Infinity) <= 60, 'First automation should be available within about one minute');
  assert(boughtAt.abiogenesis >= 7.5 * 60 && boughtAt.abiogenesis <= 12.5 * 60,
    'This active-player route should reach life in about 8–12 minutes');
  assert(state.elapsed >= 30 * 60 && state.elapsed <= 45 * 60,
    'This active-player route should complete in about 30–45 minutes');
  return { state, purchases, boughtAt };
}

if (process.argv[1]?.endsWith('playthrough.ts')) {
  const { state } = runJourney();
  const statePath = process.env.JOURNEY_STATE_PATH;
  if (statePath) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(`Legal completed game state exported to ${statePath}`);
  }
}
