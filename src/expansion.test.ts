import { describe, expect, it } from 'vitest';
import {
  act, available, BALANCE, COSMIC_PROJECT_IDS, createGame, planetStage, protostarSeconds, quote, requirements,
  tick, worldEffects, type GameState, type PlanetProfile, type ResourceId,
} from './game';

function funded(): GameState {
  const state = createGame(0);
  for (const id of Object.keys(state.resources) as ResourceId[]) state.resources[id] = 10000;
  state.cosmos.density = 100;
  state.cosmos.cooling = 100;
  state.cosmos.discoveries = ['cloud', 'fusion', 'enrichment'];
  return state;
}

function assembled(): GameState {
  let state = funded();
  state.buildings.stableStar = 1;
  state = act(state, { type: 'buy', id: 'planet' });
  for (const id of COSMIC_PROJECT_IDS) state = act(state, { type: 'buy', id });
  return state;
}

describe('cloud development and stellar formation', () => {
  it('discovers cloud research, develops conditions, and leaves collapse to the player', () => {
    const before = createGame(0);
    before.resources.hydrogen = 1000;
    expect(available(before, 'compression')).toBe(false);
    let state = act(before, { type: 'buy', id: 'cloud' });
    expect(state.cosmos.discoveries).toContain('cloud');
    expect(available(state, 'compression')).toBe(true);
    state = tick(state, 90);
    expect(state.cosmos.density).toBeGreaterThan(45);
    expect(state.cosmos.cooling).toBeGreaterThan(35);
    expect(state.cosmos.protostars).toHaveLength(0);
    expect(state.buildings.cloud).toBe(1);
    expect(before.cosmos.discoveries).toEqual([]);
  });

  it('rejects collapse atomically until density, cooling, and a cloud are available', () => {
    const state = funded();
    state.buildings.cloud = 1;
    state.cosmos.density = 44;
    expect(act(state, { type: 'buy', id: 'stableStar' })).toBe(state);
    expect(requirements(state, 'stableStar').join(' ')).toMatch(/density/i);
    state.cosmos.density = 100;
    state.cosmos.cooling = 34;
    expect(act(state, { type: 'buy', id: 'stableStar' })).toBe(state);
    expect(state.buildings.cloud).toBe(1);
    expect(state.resources.hydrogen).toBe(10000);
  });

  it('spends one cloud and the quoted cost to queue a star, then ignites it exactly once', () => {
    const before = funded();
    before.buildings.cloud = 1;
    const cost = quote(before, 'stableStar');
    const queued = act(before, { type: 'buy', id: 'stableStar' });
    expect(queued.buildings.cloud).toBe(0);
    expect(queued.resources.hydrogen).toBe(before.resources.hydrogen - cost.hydrogen!);
    expect(queued.buildings.stableStar ?? 0).toBe(0);
    expect(queued.cosmos.protostars).toHaveLength(1);
    expect(before.cosmos.protostars).toHaveLength(0);
    const ignited = tick(queued, BALANCE.starFormationSeconds.stableStar + 1);
    expect(ignited.cosmos.protostars).toHaveLength(0);
    expect(ignited.buildings.stableStar).toBe(1);
    expect(ignited.cosmos.discoveries.filter(id => id === 'fusion')).toHaveLength(1);
    expect(tick(ignited, 60).buildings.stableStar).toBe(1);
  });

  it('pauses an unfed protostar and resumes from collector production without negative inputs', () => {
    const state = createGame(0);
    state.cosmos.nextStarId = 2;
    state.cosmos.protostars = [{ id: 1, kind: 'stableStar', remaining: 20, total: 20 }];
    const paused = tick(state, 60);
    expect(paused.cosmos.protostars[0].remaining).toBe(20);
    paused.resources.hydrogen = BALANCE.protostarHydrogen / 2;
    const limited = tick(paused, 1);
    expect(limited.cosmos.protostars[0].remaining).toBeCloseTo(19.5, 8);
    expect(limited.resources.hydrogen).toBe(0);
    limited.buildings.collector = 1;
    const recovered = tick(limited, 30);
    expect(recovered.buildings.stableStar).toBe(1);
    expect(Object.values(recovered.resources).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it('records the first forming-star milestone once even when several stars are queued together', () => {
    let state = funded();
    state.buildings.cloud = 3;
    for (let count = 0; count < 3; count++) state = act(state, { type: 'buy', id: 'stableStar' });
    expect(state.cosmos.protostars).toHaveLength(3);
    expect(state.history.filter(entry => entry.id === 'stableStar-forming')).toHaveLength(1);
    state = tick(state, 30);
    expect(state.buildings.stableStar).toBe(3);
    expect(state.history.filter(entry => entry.id === 'stableStar')).toHaveLength(1);
  });

  it('predicts the actual fed ignition time after stellar observations accelerate maturation', () => {
    let state = funded();
    state.buildings.cloud = 1;
    state.upgrades.stellarSurvey = 1;
    state = act(state, { type: 'buy', id: 'stableStar' });
    const star = state.cosmos.protostars[0];
    const seconds = protostarSeconds(state, star);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(star.remaining);
    const justBefore = tick(state, seconds - 0.01);
    expect(justBefore.cosmos.protostars).toHaveLength(1);
    expect(justBefore.buildings.stableStar ?? 0).toBe(0);
    const atIgnition = tick(state, seconds);
    expect(atIgnition.cosmos.protostars).toHaveLength(0);
    expect(atIgnition.buildings.stableStar).toBe(1);
    expect(tick(justBefore, 0.01).buildings.stableStar).toBe(1);
    expect(tick(atIgnition, 30).buildings.stableStar).toBe(1);
    expect(atIgnition.history.filter(entry => entry.id === 'stableStar')).toHaveLength(1);
  });

  it('keeps fractional ignition and supernova events consistent across elapsed-time intervals', () => {
    const state = funded();
    state.cosmos.nextStarId = 3;
    state.cosmos.protostars = [
      { id: 1, kind: 'stableStar', remaining: 0.25, total: 20 },
      { id: 2, kind: 'massiveStar', remaining: 0.5, total: 30 },
    ];
    const whole = tick(state, 100);
    let split = state;
    for (let index = 0; index < 400; index++) split = tick(split, 0.25);
    expect(whole.stats.supernovae).toBe(1);
    expect(whole.stars).toEqual(split.stars);
    expect(whole.cosmos).toEqual(split.cosmos);
    for (const id of Object.keys(state.resources) as ResourceId[]) {
      expect(whole.resources[id]).toBeCloseTo(split.resources[id], 7);
    }
    expect(tick(whole, 100).stats.supernovae).toBe(1);
  });

  it('keeps stellar choices useful: small stars cost less and Sun-like stars fuse faster', () => {
    const state = funded();
    state.buildings.cloud = 1;
    expect(quote(state, 'redDwarf').hydrogen).toBeLessThan(quote(state, 'stableStar').hydrogen!);
    const small = tick(act(state, { type: 'buy', id: 'redDwarf' }), 40);
    const sun = tick(act(state, { type: 'buy', id: 'stableStar' }), 40);
    expect(small.buildings.redDwarf).toBe(1);
    expect(sun.buildings.stableStar).toBe(1);
    expect(sun.resources.helium).toBeGreaterThan(small.resources.helium);
  });
});

describe('staged worlds and persistent environmental choices', () => {
  it('requires construction projects in order, charges them once, and activates chemistry only at oceans', () => {
    let state = funded();
    state.buildings.stableStar = 1;
    expect(act(state, { type: 'buy', id: 'planetOceans' })).toBe(state);
    state = act(state, { type: 'buy', id: 'planet' });
    expect(planetStage(state)).toBe(1);
    expect(tick(state, 10).resources.water).toBe(state.resources.water);
    expect(act(state, { type: 'buy', id: 'planet' })).toBe(state);
    for (const [index, id] of COSMIC_PROJECT_IDS.entries()) {
      const cost = quote(state, id);
      const before = state;
      state = act(state, { type: 'buy', id });
      expect(planetStage(state)).toBe(index + 2);
      for (const resource of Object.keys(cost) as ResourceId[]) {
        expect(state.resources[resource]).toBe(before.resources[resource] - cost[resource]!);
      }
      expect(act(state, { type: 'buy', id })).toBe(state);
    }
    expect(tick(state, 10).resources.water).toBeGreaterThan(state.resources.water);
    expect(available(state, 'planet')).toBe(true);
    expect(quote(state, 'planet')).toEqual(BALANCE.extraPlanetCost);
  });

  it('retains explicit environmental requirements even when water and compounds are abundant', () => {
    const state = assembled();
    state.habitability = 100;
    Object.assign(state.planet, { temperature: 100, waterCoverage: 100, atmosphere: 54, nutrients: 100 });
    expect(available(state, 'abiogenesis')).toBe(false);
    expect(requirements(state, 'abiogenesis').join(' ')).toMatch(/atmospher/i);
    expect(act(state, { type: 'buy', id: 'abiogenesis' })).toBe(state);
    state.planet.atmosphere = 55;
    const living = act(state, { type: 'buy', id: 'abiogenesis' });
    expect(living.phase).toBe(1);
    expect(living.upgrades.planetOceans).toBe(1);
    expect(living.buildings.stableStar).toBe(1);
  });

  it.each(['balanced', 'oceanic', 'active', 'mineral'] as PlanetProfile[])
  ('allows the %s world to recover and revisit its profile without losing life', profile => {
    let state = assembled();
    state.phase = 1;
    state.upgrades.abiogenesis = 1;
    state.buildings.colony = 1;
    state = act(state, { type: 'profile', profile });
    expect(state.planet.profile).toBe(profile);
    for (const id of Object.keys(state.resources) as ResourceId[]) state.resources[id] = 0;
    Object.assign(state.planet, { temperature: 0, waterCoverage: 0, atmosphere: 0, nutrients: 0 });
    const repaired = act(state, { type: 'stabilize' });
    expect(repaired.planet.temperature).toBeGreaterThan(0);
    expect(repaired.planet.waterCoverage).toBeGreaterThan(0);
    const revised = act(repaired, { type: 'profile', profile: 'balanced' });
    expect(revised.planet.profile).toBe('balanced');
    expect(revised.upgrades.abiogenesis).toBe(1);
    expect(revised.phase).toBe(1);
  });

  it('carries planetary traits and complementary habitats into ecosystem output', () => {
    const state = assembled();
    state.upgrades.land = 1;
    const baseline = worldEffects(state);
    state.planet.profile = 'oceanic';
    expect(worldEffects(state).water).toBeGreaterThan(baseline.water);
    expect(worldEffects(state).biomass).toBeGreaterThan(baseline.biomass);
    expect(worldEffects(state).demand).toBeGreaterThan(baseline.demand);
    state.upgrades.climateRegulation = 1;
    expect(worldEffects(state).demand).toBeLessThan(baseline.demand);
    state.planet.profile = 'mineral';
    const mineral = worldEffects(state);
    expect(mineral.materials).toBeGreaterThan(baseline.materials);
    expect(mineral.food).toBeLessThan(baseline.food);
    state.upgrades.nutrientCycling = 1;
    expect(worldEffects(state).food).toBeGreaterThan(baseline.food);
    const previous = worldEffects(state);
    for (const id of ['tidalPools', 'mineralSurfaces', 'oceanVents']) state.upgrades[id] = 1;
    expect(worldEffects(state).biomass).toBeGreaterThan(previous.biomass);
    expect(worldEffects(state).evolution).toBeGreaterThan(previous.evolution);
    expect(worldEffects(state).prebiotic).toBeGreaterThan(previous.prebiotic);
  });

  it('unlocks discoveries and their research from events without awarding a discovery twice', () => {
    let state = assembled();
    expect(state.cosmos.discoveries).toContain('ocean');
    expect(available(state, 'climateRegulation')).toBe(true);
    Object.assign(state.planet, { temperature: 80, waterCoverage: 80, atmosphere: 80, nutrients: 80 });
    state = tick(state, 2);
    expect(state.cosmos.discoveries).toContain('waterCycle');
    const after = tick(state, 20);
    expect(after.cosmos.discoveries.filter(id => id === 'waterCycle')).toHaveLength(1);
    expect(available(after, 'nutrientCycling')).toBe(true);
  });
});
