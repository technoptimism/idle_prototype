import { describe, expect, it } from 'vitest';
import {
  act, BIO_IDS, COSMIC_PROJECT_IDS, createGame, preset, quote, requirements,
  type GameState,
} from './game';
import { getLearningJourney } from './progression';

const current = (game: GameState) => getLearningJourney(game).current;

function oceanWorld(): GameState {
  const game = createGame(0);
  Object.assign(game.buildings, { collector: 6, stableStar: 1, planet: 1, pond: 1 });
  for (const id of COSMIC_PROJECT_IDS) game.upgrades[id] = 1;
  game.upgrades.stellarAutomation = 1;
  game.automation = true;
  game.stats.supernovae = 1;
  game.cosmos.discoveries = ['cloud', 'fusion', 'enrichment', 'ocean'];
  game.habitability = 80;
  Object.assign(game.planet, { temperature: 80, atmosphere: 80, nutrients: 80, waterCoverage: 80 });
  return game;
}

describe('derived learning path', () => {
  it('teaches gathering before the first affordable collector', () => {
    let game = createGame(0);
    expect(current(game)).toMatchObject({
      kind: 'gather', action: { type: 'gather' }, progress: 0,
      target: { phase: 0, view: 'build', cardId: 'gather-hydrogen' },
    });
    for (let tap = 0; tap < 15; tap++) game = act(game, { type: 'gather' });
    expect(current(game)).toMatchObject({ kind: 'purchase', actionId: 'collector', cost: quote(game, 'collector'), missing: [] });
  });

  it('uses the next real purchase quote while explaining a multi-purchase target', () => {
    const game = createGame(0);
    game.buildings.collector = 1;
    const before = structuredClone(game);
    expect(current(game)).toMatchObject({
      actionId: 'collector', count: { current: 1, target: 3 },
      cost: quote(game, 'collector'), missing: requirements(game, 'collector'),
    });
    expect(game).toEqual(before);
  });

  it('shows exact cloud readiness scores before asking for a star', () => {
    const game = createGame(0);
    Object.assign(game.buildings, { collector: 3, cloud: 1 });
    game.upgrades.collection = 1;
    Object.assign(game.cosmos, { density: 44, cooling: 34 });
    expect(current(game)).toMatchObject({ id: 'stableStar-conditions', kind: 'wait', target: { cardId: 'stellar-nursery' } });
    expect(current(game).missing).toEqual([
      'Cloud density: 44 / 45% (missing 1%).',
      'Radiative cooling: 34 / 35% (missing 1%).',
    ]);
  });

  it.each(['stableStar', 'redDwarf'] as const)('teaches feeding a queued %s without replacing its consumed cloud', kind => {
    const game = createGame(0);
    game.cosmos.protostars = [{ id: 1, kind, remaining: 6, total: 12 }];
    const step = current(game);
    expect(step).toMatchObject({ id: 'stableStar-ignition', kind: 'wait', progress: 0.5, target: { cardId: 'stellar-nursery' } });
    expect(step.missing[0]).toContain('6 seconds of fed formation remain');
    expect(step.missing[0]).toContain('0.65 hydrogen/s');
  });

  it('moves from a mature stable star to its helium output without replaying collector lessons', () => {
    const game = createGame(0);
    game.buildings.redDwarf = 1;
    expect(current(game)).toMatchObject({ id: 'first-helium', kind: 'wait', cost: { helium: 20 } });
    expect(current(game).missing[0]).toContain('Helium: 0 / 20 (missing 20)');
  });

  it('does not ask to recreate a consumed cloud while a massive star is maturing', () => {
    const game = createGame(0);
    game.buildings.stableStar = 1;
    game.buildings.massiveStar = 1;
    game.stars = [{ id: 2, remaining: 45 }];
    expect(current(game)).toMatchObject({ id: 'stellar-enrichment', progress: 0.5, kind: 'wait' });
    game.stars = [];
    game.buildings.massiveStar = 0;
    game.stats.supernovae = 1;
    expect(current(game)).toMatchObject({ actionId: 'planet', target: { phase: 0, view: 'world', cardId: 'planet-construction' } });
  });

  it('introduces biological production first when life begins, including existing saves', () => {
    const game = createGame(0);
    game.phase = 1;
    game.upgrades.abiogenesis = 1;
    game.buildings.colony = 1;
    expect(current(game)).toMatchObject({ actionId: 'colony', count: { current: 1, target: 2 }, target: { phase: 1, view: 'build' } });
    const existing = preset(1);
    expect(current(existing)).toMatchObject({ actionId: 'photosynthesis', target: { phase: 1, view: 'research' } });
    expect(getLearningJourney(existing).chapter).toBe('Grow a food web');
  });

  it.each(['tidalPools', 'mineralSurfaces', 'oceanVents'])('accepts %s as a useful prebiotic habitat', habitat => {
    const game = oceanWorld();
    game.upgrades[habitat] = 1;
    expect(current(game)).toMatchObject({ id: 'life-reserves', kind: 'wait', cost: quote(game, 'abiogenesis') });
    expect(getLearningJourney(game).upcoming.some(step => step.name === 'Develop a prebiotic habitat')).toBe(false);
  });

  it.each(['metabolism', 'reproduction'])('accepts %s as the first biological strategy', strategy => {
    const game = preset(1);
    game.upgrades.photosynthesis = 1;
    game.upgrades[strategy] = 1;
    game.buildings.producer = 2;
    expect(current(game)).toMatchObject({ actionId: 'eukaryotes' });
  });

  it('skips early production lessons for established lineages and teaches the next ecological dependency', () => {
    const game = preset(1);
    Object.assign(game.upgrades, { photosynthesis: 1, eukaryotes: 1, multicellular: 1 });
    game.buildings.producer = 2;
    expect(current(game)).toMatchObject({ actionId: 'animals' });
    game.upgrades.animals = 1;
    expect(current(game)).toMatchObject({ actionId: 'producer', count: { current: 2, target: 3 } });
    game.buildings.producer = 3;
    expect(current(game)).toMatchObject({ actionId: 'vertebrates' });
  });

  it('offers a free recovery action before humans without granting health or spending resources', () => {
    const game = preset(1);
    for (const id of BIO_IDS.filter(id => id !== 'humans')) game.upgrades[id] = 1;
    game.buildings.producer = 8;
    game.health = 49;
    const before = structuredClone(game);
    expect(current(game)).toMatchObject({ id: 'human-health', action: { type: 'restore' }, cost: {}, progress: 0.98, target: { phase: 1, view: 'world', cardId: 'biosphere-care' } });
    expect(current(game).missing).toEqual(['Biosphere health: 49 / 50% (missing 1%).']);
    expect(game).toEqual(before);
    const recovered = act(game, { type: 'restore' });
    expect(current(recovered)).toMatchObject({ actionId: 'humans' });
    expect(recovered.resources).toEqual(game.resources);
  });

  it('starts civilization with its material source and expands it before housing demands', () => {
    const game = preset(2);
    delete game.buildings.workshop;
    expect(current(game)).toMatchObject({ actionId: 'workshop', target: { phase: 2, view: 'build' } });
    game.buildings.workshop = 1;
    game.upgrades.agriculture = 1;
    expect(current(game)).toMatchObject({ actionId: 'workshop', count: { current: 1, target: 3 } });
    game.buildings.workshop = 3;
    expect(current(game)).toMatchObject({ actionId: 'farm', count: { target: 4 } });
  });

  it('keeps progress finite and bounded and permits continued play after completion', () => {
    const game = createGame(0);
    game.resources.hydrogen = 1e15;
    expect(current(game).progress).toBe(1);
    const finished = preset(2);
    finished.completed = true;
    const before = structuredClone(finished);
    expect(current(finished)).toMatchObject({ id: 'completed', kind: 'wait', target: { label: 'Keep building' } });
    expect(current(finished).action).toBeUndefined();
    expect(finished).toEqual(before);
  });
});
