import { describe, expect, it } from 'vitest';
import { act, available, bottlenecks, createGame, quote, rates, requirements, tick, type GameState, type ResourceId } from './game';

const rich = (): GameState => {
  const state = createGame(0);
  for (const key of Object.keys(state.resources) as ResourceId[]) state.resources[key] = 100000;
  state.cosmos.density = 100;
  state.cosmos.cooling = 100;
  Object.assign(state.planet, { temperature: 80, waterCoverage: 80, atmosphere: 80, nutrients: 80 });
  return state;
};

function readyPlanet(state: GameState) {
  state.buildings.planet = 1;
  for (const id of ['planetCore', 'planetSurface', 'planetAtmosphere', 'planetOceans']) state.upgrades[id] = 1;
}

describe('atomic actions and spending', () => {
  it('gathers hydrogen before automation and does not mutate the previous state', () => {
    const before = createGame(0);
    const after = act(before, { type: 'gather' });
    expect(after.resources.hydrogen).toBeGreaterThan(before.resources.hydrogen);
    expect(after.stats.taps).toBe(before.stats.taps + 1);
    expect(before.resources.hydrogen).toBe(0);
  });

  it('charges an affordable purchase exactly once at the update boundary', () => {
    const before = rich();
    const cost = quote(before, 'collector');
    const after = act(before, { type: 'buy', id: 'collector' });
    expect(after.buildings.collector).toBe((before.buildings.collector ?? 0) + 1);
    for (const key of Object.keys(before.resources) as ResourceId[]) {
      expect(after.resources[key]).toBeCloseTo(before.resources[key] - (cost[key] ?? 0), 8);
    }
    expect(before.buildings.collector ?? 0).toBe(0);
  });

  it('rejects insufficient, unknown, and prerequisite-blocked purchases without partial spending', () => {
    const empty = createGame(0);
    expect(act(empty, { type: 'buy', id: 'collector' })).toEqual(empty);
    expect(act(empty, { type: 'buy', id: '__unknown__' })).toEqual(empty);
    const wealthy = rich();
    expect(available(wealthy, 'humans')).toBe(false);
    expect(requirements(wealthy, 'humans').length).toBeGreaterThan(0);
    expect(act(wealthy, { type: 'buy', id: 'humans' })).toEqual(wealthy);
  });

  it('does not consume a gas cloud or hydrogen when helium is missing', () => {
    const before = rich();
    before.buildings.stableStar = 1;
    before.buildings.cloud = 1;
    before.resources.helium = 0;
    const after = act(before, { type: 'buy', id: 'massiveStar' });
    expect(after).toEqual(before);
    expect(after.buildings.cloud).toBe(1);
    expect(after.stars).toHaveLength(0);
  });

  it.each(['__proto__', 'constructor', 'toString'])('rejects inherited object key %s as an unknown purchase', id => {
    const before = rich();
    expect(available(before, id)).toBe(false);
    expect(requirements(before, id)).toEqual(['Unknown purchase.']);
    expect(quote(before, id)).toEqual({});
    expect(act(before, { type: 'buy', id })).toBe(before);
    expect(Object.getPrototypeOf(before.upgrades)).toBe(Object.prototype);
  });

  it('never re-awards a single-use milestone', () => {
    const before = rich();
    // Photosynthesis requires established first cells, but this test isolates its single-use boundary.
    before.phase = 1;
    before.upgrades.abiogenesis = 1;
    before.buildings.colony = 1;
    const after = act(before, { type: 'buy', id: 'photosynthesis' });
    expect(after.upgrades.photosynthesis).toBe(1);
    expect(act(after, { type: 'buy', id: 'photosynthesis' })).toEqual(after);
    expect(after.history.filter(entry => entry.id === 'photosynthesis')).toHaveLength(1);
  });

  it('keeps first-purchase history compact when a consumed cloud is bought again', () => {
    let state = rich();
    state = act(state, { type: 'buy', id: 'cloud' });
    state = act(state, { type: 'buy', id: 'stableStar' });
    state = tick(state, 20);
    state = act(state, { type: 'buy', id: 'cloud' });
    expect(state.buildings.cloud).toBe(1);
    expect(state.history.filter(entry => entry.id === 'cloud')).toHaveLength(1);
    expect(state.history.filter(entry => entry.id === 'stableStar')).toHaveLength(1);
  });
});

describe('elapsed-time production', () => {
  it('automates gathering in every selected phase and does not mutate input state', () => {
    const before = createGame(0);
    before.buildings.collector = 2;
    before.phase = 2;
    const after = tick(before, 10);
    expect(after.resources.hydrogen).toBeGreaterThan(before.resources.hydrogen);
    expect(after.elapsed).toBeCloseTo(before.elapsed + 10, 8);
    expect(before.resources.hydrogen).toBe(0);
  });

  it('limits fusion to available hydrogen and remains finite under shortages', () => {
    const before = createGame(0);
    before.buildings.stableStar = 5;
    before.resources.hydrogen = 1;
    const after = tick(before, 120);
    expect(after.resources.hydrogen).toBeGreaterThanOrEqual(0);
    expect(after.resources.helium).toBeLessThanOrEqual(1);
    for (const count of Object.values(after.resources)) {
      expect(Number.isFinite(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it('requires stellar conditions for manual fusion and elemental inputs for planetary chemistry', () => {
    const before = createGame(0);
    before.resources.hydrogen = 100;
    expect(act(before, { type: 'fuse' })).toEqual(before);
    before.buildings.stableStar = 1;
    readyPlanet(before);
    const fused = act(before, { type: 'fuse' });
    expect(fused.resources.hydrogen).toBeLessThan(before.resources.hydrogen);
    expect(fused.resources.helium).toBeGreaterThan(0);
    const dry = tick(before, 20);
    expect(dry.resources.water).toBe(0);
    expect(dry.resources.prebiotic).toBe(0);
  });

  it('resolves massive-star maturity once, consuming the star and releasing elements', () => {
    const before = createGame(0);
    before.buildings.massiveStar = 1;
    before.stars = [{ id: 0, remaining: 3 }];
    const after = tick(before, 10);
    expect(after.stars).toHaveLength(0);
    expect(after.buildings.massiveStar).toBe(0);
    expect(after.stats.supernovae).toBe(1);
    expect(after.resources.carbon).toBeGreaterThan(0);
    expect(after.resources.oxygen).toBeGreaterThan(0);
    expect(after.resources.elements).toBeGreaterThan(0);
    const later = tick(after, 20);
    expect(later.stats.supernovae).toBe(1);
    expect(later.resources.carbon).toBe(after.resources.carbon);
  });

  it.each([0, 0.25])('makes a supernova at %ss available to chemistry during the rest of the interval', remaining => {
    const before = createGame(0);
    before.buildings.stableStar = 1;
    readyPlanet(before);
    before.buildings.massiveStar = 1;
    before.resources.hydrogen = 100;
    before.stars = [{ id: 1, remaining }];
    const after = tick(before, 1);
    expect(after.stats.supernovae).toBe(1);
    expect(after.stars).toHaveLength(0);
    expect(after.resources.water).toBeGreaterThan(0);
    expect(after.resources.prebiotic).toBeGreaterThan(0);
    if (remaining > 0) {
      const early = tick(before, remaining);
      expect(early.resources.water).toBe(0);
      expect(early.resources.prebiotic).toBe(0);
    }
  });

  it('produces the same result for one elapsed interval and equivalent shorter intervals', () => {
    const before = createGame(0);
    before.buildings.collector = 3;
    before.buildings.stableStar = 1;
    before.resources.hydrogen = 100;
    before.buildings.massiveStar = 1;
    before.stars = [{ id: 1, remaining: 6 }];
    let split = before;
    for (let i = 0; i < 20; i++) split = tick(split, 1);
    const whole = tick(before, 20);
    for (const key of Object.keys(before.resources) as ResourceId[]) {
      expect(whole.resources[key]).toBeCloseTo(split.resources[key], 8);
    }
    expect(whole.stats).toEqual(split.stats);
    expect(whole.stars).toEqual(split.stars);
  });

  it('ignores invalid time inputs', () => {
    const before = createGame(0);
    for (const seconds of [-5, NaN, Infinity]) expect(tick(before, seconds)).toEqual(before);
  });

  it('reports input-limited net rates and actionable shortage information without changing state', () => {
    const before = createGame(0);
    before.buildings.stableStar = 1;
    const snapshot = structuredClone(before);
    expect(rates(before).helium).toBe(0);
    expect(bottlenecks(before).join(' ')).toContain('Hydrogen');
    before.buildings.collector = 2;
    const flow = rates(before);
    const after = tick(before, 1);
    for (const key of Object.keys(before.resources) as ResourceId[]) {
      expect(flow[key]).toBeCloseTo(after.resources[key] - before.resources[key], 8);
    }
    delete before.buildings.collector;
    expect(before).toEqual(snapshot);
  });
});

describe('connected phase transitions', () => {
  it('requires visible planetary conditions before life and preserves the cosmic economy', () => {
    const before = rich();
    before.buildings.collector = 4;
    before.buildings.stableStar = 1;
    readyPlanet(before);
    before.habitability = 69;
    expect(act(before, { type: 'buy', id: 'abiogenesis' })).toEqual(before);
    before.habitability = 70;
    const after = act(before, { type: 'buy', id: 'abiogenesis' });
    expect(after.phase).toBe(1);
    expect(after.buildings.collector).toBe(4);
    expect(after.resources.biomass).toBeGreaterThan(0);
    expect(after.upgrades.abiogenesis).toBe(1);
  });

  it('requires ancestry to unlock humans and introduces civilization without resetting life', () => {
    const before = rich();
    before.phase = 1;
    before.buildings.colony = 5;
    before.buildings.producer = 8;
    before.upgrades.abiogenesis = 1;
    expect(act(before, { type: 'buy', id: 'humans' })).toEqual(before);
    for (const id of ['photosynthesis', 'eukaryotes', 'multicellular', 'animals', 'vertebrates', 'land', 'mammals', 'primates']) {
      before.upgrades[id] = 1;
    }
    const after = act(before, { type: 'buy', id: 'humans' });
    expect(after.phase).toBe(2);
    expect(after.population).toBeGreaterThan(0);
    expect(after.buildings.colony).toBe(5);
    expect(after.resources.knowledge).toBeGreaterThan(0);
  });

  it('requires a healthy biosphere for the final observatory and permits recovery from shortages', () => {
    const before = rich();
    before.phase = 2;
    for (const id of ['humans', 'agriculture', 'writing', 'industry', 'electricity', 'computing', 'spaceflight']) before.upgrades[id] = 1;
    before.health = 59;
    expect(act(before, { type: 'buy', id: 'observatory' })).toEqual(before);
    const exhausted = createGame(0);
    exhausted.phase = 2;
    exhausted.upgrades.humans = 1;
    exhausted.health = 1;
    const recovered = act(exhausted, { type: 'restore' });
    expect(recovered.health).toBeGreaterThan(exhausted.health);
    before.health = 60;
    const after = act(before, { type: 'buy', id: 'observatory' });
    expect(after.completed).toBe(true);
    expect(after.completedAt).not.toBeNull();
    expect(act(after, { type: 'buy', id: 'observatory' })).toEqual(after);
  });
});
