import { createGame, tick, type GameState, type ResourceId } from './game';
import { BUILDINGS, COSMIC_PROJECT_IDS, DISCOVERY_IDS, PROFILE_DEFINITIONS, STAR_IDS, UPGRADES } from './game/data';

export type SaveSlot = 'normal' | 'developer';
export const SAVE_VERSION = 2;
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
export const SAVE_KEYS: Record<SaveSlot, string> = {
  // Keep the original keys: updating the app must never strand an existing universe.
  normal: 'stardust-to-civilization:normal:v1',
  developer: 'stardust-to-civilization:developer:v1',
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveResult { ok: boolean; message: string | null }
export interface LoadResult {
  state: GameState | null;
  message: string | null;
  offline: { seconds: number; summary: string } | null;
  /** An unreadable existing save is preserved until the player explicitly resets it. */
  blocked: boolean;
}

const RESOURCE_IDS: ResourceId[] = [
  'hydrogen', 'helium', 'carbon', 'oxygen', 'elements', 'water', 'prebiotic',
  'biomass', 'evolution', 'food', 'materials', 'knowledge', 'energy',
];
const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integer = (value: unknown): value is number => nonnegative(value) && Number.isInteger(value);
const countRecord = (value: unknown, whole = false): boolean => plain(value)
  && Object.entries(value).every(([key, count]) =>
    key !== '__proto__' && key !== 'prototype' && key !== 'constructor'
    && (whole ? integer(count) : nonnegative(count)));

function validBaseState(value: unknown, version: number): value is Record<string, unknown> {
  if (!plain(value) || value.version !== version || ![0, 1, 2].includes(value.phase as number)) return false;
  const resources = value.resources;
  if (!plain(resources) || !RESOURCE_IDS.every(id => nonnegative(resources[id]))) return false;
  if (!countRecord(value.buildings, true) || !countRecord(value.upgrades, true)
    || !countRecord(value.populations)) return false;
  for (const [record, definitions] of [[value.buildings, BUILDINGS], [value.upgrades, UPGRADES]] as const) {
    if (!plain(record) || !Object.entries(record).every(([id, count]) => {
      const definition = definitions.find(item => item.id === id);
      return definition && integer(count) && count <= (definition.max ?? 1);
    })) return false;
  }
  if (!nonnegative(value.elapsed) || !nonnegative(value.population) || !nonnegative(value.lastSaved)
    || !nonnegative(value.health) || value.health > 100
    || !nonnegative(value.habitability) || value.habitability > 100) return false;
  if (typeof value.completed !== 'boolean' || typeof value.automation !== 'boolean'
    || !(value.completedAt === null || nonnegative(value.completedAt))) return false;
  if (!plain(value.stats) || !integer(value.stats.taps) || !integer(value.stats.supernovae)
    || !nonnegative(value.stats.totalHydrogen)) return false;
  if (!Array.isArray(value.stars) || !value.stars.every(star => plain(star)
    && integer(star.id) && nonnegative(star.remaining))) return false;
  if (new Set(value.stars.map(star => (star as { id: number }).id)).size !== value.stars.length) return false;
  return Array.isArray(value.history) && value.history.every(entry => plain(entry)
    && typeof entry.id === 'string' && typeof entry.name === 'string' && nonnegative(entry.time));
}

const percent = (value: unknown): value is number => nonnegative(value) && value <= 100;
const discoveryIds = new Set<string>(DISCOVERY_IDS);
const starKinds = new Set<string>(STAR_IDS);
const planetProfiles = new Set<string>(PROFILE_DEFINITIONS.map(profile => profile.id));

/** Validate before loading or saving. Corrupt data never reaches the simulation. */
export function isGameState(value: unknown): value is GameState {
  if (!validBaseState(value, SAVE_VERSION)) return false;
  const upgrades = value.upgrades as Record<string, number>;
  let previousStageBuilt = ((value.buildings as Record<string, number>).planet ?? 0) > 0;
  for (const id of COSMIC_PROJECT_IDS) {
    const built = (upgrades[id] ?? 0) > 0;
    if (built && !previousStageBuilt) return false;
    previousStageBuilt = built;
  }
  const cosmos = value.cosmos;
  const planet = value.planet;
  if (!plain(cosmos) || !percent(cosmos.density) || !percent(cosmos.cooling)
    || !integer(cosmos.nextStarId) || cosmos.nextStarId < 1
    || !Array.isArray(cosmos.discoveries)
    || !cosmos.discoveries.every(id => typeof id === 'string' && discoveryIds.has(id))
    || new Set(cosmos.discoveries).size !== cosmos.discoveries.length
    || !Array.isArray(cosmos.protostars) || !cosmos.protostars.every(star => plain(star)
      && integer(star.id) && starKinds.has(star.kind as string)
      && nonnegative(star.remaining) && nonnegative(star.total) && star.total > 0
      && star.remaining <= star.total)) return false;
  const ids = [...(value.stars as Array<{ id: number }>), ...cosmos.protostars as Array<{ id: number }>]
    .map(star => star.id);
  if (new Set(ids).size !== ids.length || ids.some(id => id >= (cosmos.nextStarId as number))) return false;
  return plain(planet) && planetProfiles.has(planet.profile as string)
    && ['temperature', 'waterCoverage', 'atmosphere', 'nutrients'].every(id => percent(planet[id]));
}

/** New projects are grandfathered for established v1 worlds; all earned progress survives. */
function migrateLegacyState(value: unknown): GameState | null {
  if (!validBaseState(value, 1)) return null;
  const defaults = createGame(value.lastSaved as number);
  const buildings = { ...value.buildings as Record<string, number> };
  const upgrades = { ...value.upgrades as Record<string, number> };
  const stars = value.stars as GameState['stars'];
  const hasPlanet = (buildings.planet ?? 0) > 0;
  const hasStar = (buildings.stableStar ?? 0) > 0 || stars.length > 0;
  const discoveries: string[] = [];
  if (buildings.cloud || hasStar || hasPlanet) discoveries.push('cloud');
  if (hasStar || (value.resources as Record<string, number>).helium > 0) discoveries.push('fusion');
  if ((value.stats as GameState['stats']).supernovae > 0 || hasPlanet) discoveries.push('enrichment');
  if (hasPlanet) {
    for (const id of ['planetCore', 'planetSurface', 'planetAtmosphere', 'planetOceans']) upgrades[id] = 1;
    discoveries.push('ocean', 'waterCycle');
  }
  const migrated = {
    ...value, version: SAVE_VERSION, buildings, upgrades,
    cosmos: {
      ...defaults.cosmos,
      density: buildings.cloud || hasStar || hasPlanet ? 80 : defaults.cosmos.density,
      cooling: buildings.cloud || hasStar || hasPlanet ? 80 : defaults.cosmos.cooling,
      nextStarId: Math.max(0, (value.stats as GameState['stats']).supernovae, ...stars.map(star => star.id)) + 1,
      discoveries,
    },
    planet: hasPlanet ? {
      profile: 'balanced', temperature: 70, waterCoverage: 80, atmosphere: 80, nutrients: 80,
    } : defaults.planet,
  };
  return isGameState(migrated) ? migrated : null;
}

function storageOrThrow(storage?: StorageLike): StorageLike {
  if (storage) return storage;
  if (typeof window === 'undefined') throw new Error('Browser storage is unavailable');
  return window.localStorage;
}

export function saveGame(
  state: GameState, slot: SaveSlot, now = Date.now(), storage?: StorageLike,
): SaveResult {
  if (!isGameState(state) || !nonnegative(now)) {
    return { ok: false, message: 'Progress could not be saved because its data failed validation. Your previous save is untouched.' };
  }
  try {
    const savedAt = Math.max(now, state.lastSaved);
    storageOrThrow(storage).setItem(SAVE_KEYS[slot], JSON.stringify({
      version: SAVE_VERSION, savedAt, state: { ...state, lastSaved: savedAt },
    }));
    return { ok: true, message: null };
  } catch {
    return { ok: false, message: 'Browser storage is unavailable or full. You can keep playing, but progress is currently only in memory.' };
  }
}

function duration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}

export function loadGame(slot: SaveSlot, now = Date.now(), storage?: StorageLike): LoadResult {
  let source: StorageLike;
  let raw: string | null;
  try {
    source = storageOrThrow(storage);
    raw = source.getItem(SAVE_KEYS[slot]);
  } catch {
    return {
      state: null, offline: null, blocked: true,
      message: 'Browser storage could not be read. Play can continue in memory; existing saves are protected until storage is available and you reload, or explicitly reset this slot.',
    };
  }
  if (raw === null) return { state: null, message: null, offline: null, blocked: false };
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!plain(envelope) || ![1, SAVE_VERSION].includes(envelope.version as number)
      || !nonnegative(envelope.savedAt) || !nonnegative(now)) throw new Error('Invalid save');
    const restored = envelope.version === 1 ? migrateLegacyState(envelope.state)
      : isGameState(envelope.state) ? envelope.state : null;
    if (!restored) throw new Error('Invalid save');
    const seconds = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (now - envelope.savedAt) / 1000));
    const before = restored;
    const state = seconds > 0 ? tick(before, seconds) : before;
    state.lastSaved = Math.max(now, envelope.savedAt);
    // Consume the offline interval immediately so reloading does not award it twice.
    const saved = saveGame(state, slot, now, source);
    const gains = RESOURCE_IDS.map(id => ({ id, amount: state.resources[id] - before.resources[id] }))
      .filter(({ amount }) => amount >= 1).sort((a, b) => b.amount - a.amount).slice(0, 3)
      .map(({ id, amount }) => `+${Math.floor(amount).toLocaleString()} ${id === 'elements' ? 'other elements' : id}`);
    const supernovae = state.stats.supernovae - before.stats.supernovae;
    if (supernovae > 0) gains.push(`${supernovae} supernova${supernovae === 1 ? '' : 'e'}`);
    // The nursery may queue more stars during catch-up, so queue length is not an ignition count.
    const ignitions = STAR_IDS.reduce((sum, id) => sum
      + (state.buildings[id] ?? 0) - (before.buildings[id] ?? 0), 0) + supernovae;
    if (ignitions > 0) gains.push(`${ignitions} protostar${ignitions === 1 ? '' : 's'} ignited`);
    const offline = seconds >= 5 ? {
      seconds,
      summary: `${duration(seconds)} of offline production${seconds >= OFFLINE_CAP_SECONDS ? ' (8-hour cap)' : ''}. ${gains.length ? gains.join(' · ') : 'Your existing systems continued operating.'}`,
    } : null;
    return { state, message: saved.message, offline, blocked: false };
  } catch {
    return {
      state: null, offline: null, blocked: true,
      message: 'This save is invalid or uses an unsupported version. The original save is untouched. Reset this slot explicitly to start again.',
    };
  }
}

export function deleteGame(slot: SaveSlot, storage?: StorageLike): SaveResult {
  try {
    storageOrThrow(storage).removeItem(SAVE_KEYS[slot]);
    return { ok: true, message: null };
  } catch {
    return { ok: false, message: 'Browser storage is unavailable. The saved slot could not be reset.' };
  }
}
