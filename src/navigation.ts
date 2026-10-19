import {
  BUILDING_IDS, COSMIC_PROJECT_IDS, DEFINITION_MAP, EXTRA_REQUIREMENTS,
  nextMilestone, quote,
  type GameState, type Milestone, type Phase,
} from './game';

export type ActionView = 'build' | 'research' | 'world';

export interface NavigationTarget {
  phase: Phase;
  view: ActionView;
  /** Purchase ID, or the ID of a world panel. */
  cardId?: string;
  label: string;
  hint?: string;
}

function owned(game: GameState, id: string): boolean {
  if (id === 'stableStar') return (game.buildings.stableStar ?? 0) + (game.buildings.redDwarf ?? 0) > 0;
  return ((BUILDING_IDS.has(id) ? game.buildings : game.upgrades)[id] ?? 0) > 0;
}

function destination(id: string): NavigationTarget | undefined {
  const definition = DEFINITION_MAP[id];
  if (!definition) return;
  if (id === 'planet' || COSMIC_PROJECT_IDS.includes(id)) {
    return { phase: 0, view: 'world', cardId: 'planet-construction', label: 'Go to planet construction' };
  }
  return {
    phase: definition.phase,
    view: BUILDING_IDS.has(id) ? 'build' : 'research',
    cardId: id,
    label: `Go to ${definition.name.toLowerCase()}`,
  };
}

/** Presentation guidance only: chooses where to look, never buys or changes progress. */
export function recommendNextStep(game: GameState, milestone: Milestone = nextMilestone(game)): NavigationTarget {
  if (milestone.id === 'completed') return { phase: game.phase, view: 'build', label: 'Keep building' };
  if (milestone.id === 'protostar' || milestone.id === 'enrichment') {
    return {
      phase: 0, view: 'world', cardId: 'stellar-nursery',
      label: milestone.id === 'protostar' ? 'Watch your star form' : 'View stellar nursery',
      hint: milestone.id === 'protostar' ? 'Keep hydrogen supplied while your star forms.' : 'Your massive star will release elements automatically.',
    };
  }

  // Follow actual prerequisite definitions instead of asking players to find a
  // locked research card and work backward through its Details themselves.
  const visited = new Set<string>();
  function findStep(id: string): NavigationTarget | undefined {
    const definition = DEFINITION_MAP[id];
    if (!definition || visited.has(id)) return;
    visited.add(id);

    for (const requirement of definition.requires ?? []) {
      if (owned(game, requirement)) continue;
      if (requirement === 'stableStar' && game.cosmos.protostars.some(star => star.kind !== 'massiveStar')) {
        return { phase: 0, view: 'world', cardId: 'stellar-nursery', label: 'Watch your star form', hint: 'Your stable star must ignite first.' };
      }
      const target = findStep(requirement);
      if (target) return { ...target, hint: target.hint ?? `${DEFINITION_MAP[requirement]?.name ?? requirement} is needed first.` };
    }

    for (const requirement of EXTRA_REQUIREMENTS[id] ?? []) {
      if (requirement.kind !== 'building') continue;
      const count = game.buildings[requirement.id] ?? 0;
      if (count >= requirement.amount) continue;
      const target = findStep(requirement.id);
      if (target) return {
        ...target,
        hint: target.hint ?? `Need ${requirement.amount} × ${DEFINITION_MAP[requirement.id].name.toLowerCase()} for ${definition.name.toLowerCase()}; you have ${count}.`,
      };
    }

    // New civilizations otherwise hit an unexplained wall at their first
    // materials/energy cost. Only suggest the initial source, not an endless
    // sequence of optional optimizations when an existing producer can supply it.
    const cost = quote(game, id);
    for (const [resource, source] of [['materials', 'workshop'], ['energy', 'power']] as const) {
      if (!cost[resource] || game.resources[resource] >= cost[resource]! || owned(game, source) || source === id) continue;
      const sourceDefinition = DEFINITION_MAP[source];
      if (game.phase < sourceDefinition.phase) continue;
      const target = findStep(source);
      if (target) return { ...target, hint: target.hint ?? `${sourceDefinition.name} supplies the ${resource} needed here.` };
    }
    return destination(id);
  }

  return findStep(milestone.id) ?? { phase: game.phase, view: 'build', label: 'View available buildings' };
}
