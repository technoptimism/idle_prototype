import { describe, expect, it } from 'vitest';
import { createGame, tick } from './game';
import {
  deleteGame, isGameState, loadGame, OFFLINE_CAP_SECONDS, SAVE_KEYS, SAVE_VERSION, saveGame, type StorageLike,
} from './persistence';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

/** Deliberately enumerate the old schema so this remains a real v1 fixture after future updates. */
function legacyState() {
  const game = createGame(1000);
  return {
    version: 1, resources: { ...game.resources }, buildings: { ...game.buildings } as Record<string, number>, upgrades: { ...game.upgrades },
    phase: game.phase, elapsed: 300, health: 87, habitability: 77, population: 0,
    populations: {}, stars: [] as Array<{ id: number; remaining: number }>, history: [...game.history],
    stats: { taps: 31, supernovae: 0, totalHydrogen: 333 }, completed: false, completedAt: null as number | null,
    lastSaved: 1000, automation: false,
  };
}

describe('versioned save slots', () => {
  it('round-trips normal progress and keeps the developer slot separate', () => {
    const storage = new MemoryStorage();
    const normal = createGame(1000);
    normal.resources.hydrogen = 123;
    const developer = createGame(1000);
    developer.resources.hydrogen = 999;
    expect(saveGame(normal, 'normal', 1000, storage).ok).toBe(true);
    expect(saveGame(developer, 'developer', 1000, storage).ok).toBe(true);
    expect(loadGame('normal', 1000, storage).state?.resources.hydrogen).toBe(123);
    expect(loadGame('developer', 1000, storage).state?.resources.hydrogen).toBe(999);
    expect(deleteGame('developer', storage).ok).toBe(true);
    expect(loadGame('developer', 1000, storage).state).toBeNull();
    expect(loadGame('normal', 1000, storage).state?.resources.hydrogen).toBe(123);
  });

  it('preserves corrupt and incompatible saves and reports them explicitly', () => {
    const storage = new MemoryStorage();
    for (const raw of ['{broken', JSON.stringify({ version: 999, state: createGame(0), savedAt: 0 })]) {
      storage.setItem(SAVE_KEYS.normal, raw);
      const result = loadGame('normal', 1000, storage);
      expect(result.blocked).toBe(true);
      expect(result.state).toBeNull();
      expect(result.message).toContain('original save is untouched');
      expect(storage.getItem(SAVE_KEYS.normal)).toBe(raw);
    }
  });

  it('rejects nonfinite, negative, and malformed state before overwriting a good save', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    saveGame(game, 'normal', 0, storage);
    const good = storage.getItem(SAVE_KEYS.normal);
    for (const invalid of [NaN, Infinity, -1]) {
      game.resources.hydrogen = invalid;
      expect(isGameState(game)).toBe(false);
      expect(saveGame(game, 'normal', 1000, storage).ok).toBe(false);
      expect(storage.getItem(SAVE_KEYS.normal)).toBe(good);
    }
    game.resources.hydrogen = 0;
    game.stars = [{ id: 1, remaining: 10 }, { id: 1, remaining: 10 }];
    expect(isGameState(game)).toBe(false);
  });

  it('validates all expanded conditions, profiles, event timers, and unique star IDs', () => {
    const invalid: Array<(game: ReturnType<typeof createGame>) => void> = [
      game => { game.cosmos.density = Infinity; },
      game => { game.cosmos.cooling = -1; },
      game => { game.planet.temperature = NaN; },
      game => { game.planet.atmosphere = 101; },
      game => { (game.planet as { profile: string }).profile = 'unknown'; },
      game => { game.buildings.planet = 1; game.upgrades.planetOceans = 1; },
      game => { game.cosmos.discoveries = ['cloud', 'cloud']; },
      game => { (game.cosmos as { discoveries: string[] }).discoveries = ['unknown']; },
      game => { game.cosmos.protostars = [{ id: 1, kind: 'stableStar', remaining: 21, total: 20 }]; game.cosmos.nextStarId = 2; },
      game => { game.cosmos.protostars = [{ id: 1, kind: 'stableStar', remaining: 10, total: 20 }]; game.stars = [{ id: 1, remaining: 10 }]; game.cosmos.nextStarId = 2; },
    ];
    for (const corrupt of invalid) {
      const game = createGame(0);
      corrupt(game);
      expect(isGameState(game)).toBe(false);
    }
  });

  it.each(['fresh', 'cloud', 'stellar', 'planet', 'biology', 'civilization', 'completed'] as const)
  ('migrates a legacy %s save without losing its earned progress or original slot', stage => {
    const storage = new MemoryStorage();
    const game = legacyState();
    game.resources.hydrogen = 512;
    if (stage !== 'fresh') Object.assign(game.buildings, { collector: 4, cloud: 1 });
    if (['stellar', 'planet', 'biology', 'civilization', 'completed'].includes(stage)) {
      Object.assign(game.buildings, { stableStar: 2, massiveStar: 1 });
      game.stars = [{ id: 19, remaining: 45 }];
      game.stats.supernovae = 3;
      game.resources.helium = 42;
    }
    if (['planet', 'biology', 'civilization', 'completed'].includes(stage)) Object.assign(game.buildings, { planet: 2, pond: 3 });
    if (['biology', 'civilization', 'completed'].includes(stage)) {
      game.phase = 1;
      Object.assign(game.buildings, { colony: 6, producer: 8 });
      Object.assign(game.upgrades, { abiogenesis: 1, photosynthesis: 1, metabolism: 2, stellarAutomation: 1 });
      Object.assign(game.populations, { abiogenesis: 1000, photosynthesis: 700 });
      game.automation = true;
    }
    if (['civilization', 'completed'].includes(stage)) {
      game.phase = 2;
      game.population = 36;
      Object.assign(game.buildings, { house: 3, school: 2 });
      Object.assign(game.upgrades, { humans: 1, writing: 1 });
    }
    if (stage === 'completed') {
      Object.assign(game.upgrades, { spaceflight: 1, observatory: 1 });
      game.completed = true;
      game.completedAt = 2499;
    }
    storage.setItem(SAVE_KEYS.normal, JSON.stringify({ version: 1, savedAt: 1000, state: game }));
    const result = loadGame('normal', 1000, storage);
    expect(result.blocked).toBe(false);
    expect(result.state?.version).toBe(SAVE_VERSION);
    expect(result.state?.resources).toEqual(game.resources);
    expect(result.state?.buildings).toEqual(game.buildings);
    expect(result.state?.upgrades).toMatchObject(game.upgrades);
    for (const key of ['stats', 'stars', 'history', 'elapsed', 'health', 'habitability', 'population', 'populations', 'phase', 'automation', 'completed', 'completedAt'] as const) {
      expect(result.state?.[key], key).toEqual(game[key]);
    }
    if (game.buildings.planet) {
      expect(result.state?.upgrades).toMatchObject({ planetCore: 1, planetSurface: 1, planetAtmosphere: 1, planetOceans: 1 });
      expect(result.state?.planet.profile).toBe('balanced');
      expect(result.state?.cosmos.discoveries).toContain('waterCycle');
    }
    expect(result.state?.cosmos.nextStarId).toBeGreaterThan(Math.max(0, ...game.stars.map(star => star.id)));
    expect(JSON.parse(storage.getItem(SAVE_KEYS.normal)!).version).toBe(SAVE_VERSION);
    expect(loadGame('normal', 1000, storage).state).toEqual(result.state);
    expect(storage.getItem(SAVE_KEYS.developer)).toBeNull();
  });

  it('protects malformed legacy data instead of upgrading and overwriting it', () => {
    const storage = new MemoryStorage();
    const game = legacyState();
    game.resources.hydrogen = -1;
    const original = JSON.stringify({ version: 1, savedAt: 1000, state: game });
    storage.setItem(SAVE_KEYS.normal, original);
    expect(loadGame('normal', 1000, storage).blocked).toBe(true);
    expect(storage.getItem(SAVE_KEYS.normal)).toBe(original);
  });

  it('migrates before offline catch-up and consumes a legacy supernova only once', () => {
    const storage = new MemoryStorage();
    const game = legacyState();
    Object.assign(game.buildings, { stableStar: 1, massiveStar: 1, planet: 1 });
    game.stars = [{ id: 7, remaining: 2 }];
    storage.setItem(SAVE_KEYS.normal, JSON.stringify({ version: 1, savedAt: 1000, state: game }));
    const result = loadGame('normal', 11000, storage);
    expect(result.state?.version).toBe(2);
    expect(result.state?.upgrades.planetOceans).toBe(1);
    expect(result.state?.stats.supernovae).toBe(1);
    expect(result.state?.stars).toEqual([]);
    expect(result.state?.resources.carbon).toBeGreaterThan(0);
    expect(result.offline?.seconds).toBe(10);
    const repeated = loadGame('normal', 11000, storage);
    expect(repeated.offline).toBeNull();
    expect(repeated.state?.stats.supernovae).toBe(1);
    expect(repeated.state?.resources).toEqual(result.state?.resources);
  });

  it('surfaces unavailable reads, writes, and resets without crashing', () => {
    const fail = () => { throw new Error('Storage disabled'); };
    const storage: StorageLike = { getItem: fail, setItem: fail, removeItem: fail };
    expect(loadGame('normal', 0, storage).message).toContain('could not be read');
    expect(loadGame('normal', 0, storage).blocked).toBe(true);
    expect(saveGame(createGame(0), 'normal', 0, storage).ok).toBe(false);
    expect(deleteGame('normal', storage).ok).toBe(false);
  });

  it('protects an unread save even when storage writes would succeed', () => {
    const storage = new MemoryStorage();
    saveGame(createGame(0), 'normal', 0, storage);
    const original = storage.data.get(SAVE_KEYS.normal);
    let writes = 0;
    const unreadable: StorageLike = {
      getItem() { throw new Error('Read unavailable'); },
      setItem(key, value) { writes++; storage.setItem(key, value); },
      removeItem(key) { storage.removeItem(key); },
    };
    const result = loadGame('normal', 100000, unreadable);
    expect(result.blocked).toBe(true);
    expect(result.state).toBeNull();
    expect(result.message).toContain('existing saves are protected');
    expect(writes).toBe(0);
    expect(storage.data.get(SAVE_KEYS.normal)).toBe(original);
  });
});

describe('offline production', () => {
  it('uses the ordinary simulation, caps at eight hours, and consumes the interval once', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    game.buildings.collector = 2;
    game.buildings.stableStar = 1;
    game.buildings.planet = 1;
    game.buildings.massiveStar = 1;
    game.stars = [{ id: 1, remaining: 45 }];
    game.cosmos.nextStarId = 2;
    game.cosmos.density = 80;
    game.cosmos.cooling = 80;
    game.cosmos.discoveries = ['cloud', 'fusion', 'enrichment', 'ocean', 'waterCycle'];
    for (const id of ['planetCore', 'planetSurface', 'planetAtmosphere', 'planetOceans']) game.upgrades[id] = 1;
    game.resources.hydrogen = 1000;
    game.resources.carbon = 50;
    game.resources.oxygen = 50;
    game.resources.elements = 50;
    game.upgrades.stellarAutomation = 1;
    game.automation = true;
    saveGame(game, 'normal', 0, storage);
    const now = 12 * 60 * 60 * 1000;
    const result = loadGame('normal', now, storage);
    const expected = tick(game, OFFLINE_CAP_SECONDS);
    expect(result.offline?.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(result.offline?.summary).toContain('8-hour cap');
    expect(result.state?.resources).toEqual(expected.resources);
    expect(result.state?.elapsed).toBe(expected.elapsed);
    expect(result.state?.stars).toEqual(expected.stars);
    expect(result.state?.stats).toEqual(expected.stats);
    expect(result.state?.buildings).toEqual(expected.buildings);
    const reloaded = loadGame('normal', now, storage);
    expect(reloaded.offline).toBeNull();
    expect(reloaded.state?.resources).toEqual(result.state?.resources);
    const later = loadGame('normal', now + 1000, storage);
    expect(later.state?.resources).toEqual(tick(result.state!, 1).resources);
  });

  it('does not purchase anything that has not been automated or authorized', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    game.buildings.collector = 1;
    game.resources.hydrogen = 100000;
    saveGame(game, 'normal', 0, storage);
    const after = loadGame('normal', 3600000, storage).state!;
    expect(after.buildings).toEqual(game.buildings);
    expect(after.upgrades).toEqual(game.upgrades);
  });

  it('does not grant a supernova reward twice across reloads', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    game.buildings.massiveStar = 1;
    game.stars = [{ id: 1, remaining: 2 }];
    game.cosmos.nextStarId = 2;
    saveGame(game, 'normal', 0, storage);
    const after = loadGame('normal', 10000, storage).state!;
    expect(after.stats.supernovae).toBe(1);
    expect(after.stars).toHaveLength(0);
    expect(after.buildings.massiveStar).toBe(0);
    const repeated = loadGame('normal', 10000, storage).state!;
    expect(repeated.stats.supernovae).toBe(1);
    expect(repeated.resources).toEqual(after.resources);
  });

  it('handles clock rollback without subtracting resources or elapsed time', () => {
    const storage = new MemoryStorage();
    const game = createGame(10000);
    saveGame(game, 'normal', 10000, storage);
    const after = loadGame('normal', 1000, storage);
    expect(after.state?.resources).toEqual(game.resources);
    expect(after.state?.elapsed).toBe(game.elapsed);
    expect(after.offline).toBeNull();
  });

  it('feeds and ignites queued protostars offline once, with the same input limits as live play', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    game.cosmos.protostars = [{ id: 1, kind: 'stableStar', remaining: 20, total: 20 }];
    game.cosmos.nextStarId = 2;
    game.resources.hydrogen = 1;
    expect(saveGame(game, 'normal', 0, storage).ok).toBe(true);
    const limited = loadGame('normal', 60000, storage).state!;
    expect(limited.cosmos.protostars).toEqual(tick(game, 60).cosmos.protostars);
    expect(limited.cosmos.protostars[0].remaining).toBeGreaterThan(0);
    expect(limited.buildings.stableStar ?? 0).toBe(0);
    limited.buildings.collector = 2;
    saveGame(limited, 'normal', 60000, storage);
    const ignited = loadGame('normal', 120000, storage).state!;
    expect(ignited.cosmos.protostars).toHaveLength(0);
    expect(ignited.buildings.stableStar).toBe(1);
    expect(ignited.cosmos.discoveries).toContain('fusion');
    expect(ignited.history.filter(entry => entry.id === 'stableStar')).toHaveLength(1);
    const repeated = loadGame('normal', 120000, storage).state!;
    expect(repeated.buildings.stableStar).toBe(1);
    expect(repeated.history).toEqual(ignited.history);
  });

  it('summarizes ignitions created by the authorized nursery as well as pre-existing queues', () => {
    const storage = new MemoryStorage();
    const game = createGame(0);
    Object.assign(game.resources, { hydrogen: 10000, helium: 10000, carbon: 100, oxygen: 100, elements: 100 });
    Object.assign(game.buildings, { collector: 20, stableStar: 1, planet: 1 });
    game.cosmos.density = 100;
    game.cosmos.cooling = 100;
    game.cosmos.discoveries = ['cloud', 'fusion', 'enrichment', 'ocean'];
    for (const id of ['planetCore', 'planetSurface', 'planetAtmosphere', 'planetOceans', 'stellarAutomation']) game.upgrades[id] = 1;
    game.automation = true;
    saveGame(game, 'normal', 0, storage);
    const result = loadGame('normal', 60000, storage);
    expect(result.state?.buildings.massiveStar).toBe(3);
    expect(result.offline?.summary).toContain('3 protostars ignited');
    expect(loadGame('normal', 60000, storage).offline).toBeNull();
  });
});
