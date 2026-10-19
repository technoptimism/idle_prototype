import {
  BALANCE, BIO_IDS, BUILDING_IDS, COSMIC_PROJECT_IDS, DEFINITION_MAP, EXTRA_REQUIREMENTS,
  HABITAT_IDS, RESOURCES, bottlenecks, conditionValue, nextMilestone, pending,
  protostarSeconds, quote, requirements,
  type Action, type Cost, type GameState, type Milestone, type ResourceId,
} from './game';
import { recommendNextStep, type NavigationTarget } from './navigation';

export interface LearningStep extends Milestone {
  target: NavigationTarget;
  lesson: string;
  actionId?: string;
  action?: Action;
  kind: 'gather' | 'purchase' | 'wait' | 'condition';
  count?: { current: number; target: number };
}

export interface LearningJourney {
  chapter: string;
  step: number;
  total: number;
  current: LearningStep;
  upcoming: Array<{ id: string; name: string }>;
}

type Lesson = { id: string; name: string; done: boolean; create: () => LearningStep };
type Chapter = { name: string; complete: boolean; lessons: Lesson[] };
const own = (game: GameState, id: string) => (BUILDING_IDS.has(id) ? game.buildings : game.upgrades)[id] ?? 0;
const ratio = (value: number, target: number) => Math.max(0, Math.min(1, Number.isFinite(value / target) ? value / target : 0));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const fmt = (value: number) => Number(value.toFixed(1)).toLocaleString('en-US');
const ever = (game: GameState, id: string) => own(game, id) > 0 || game.history.some(event => event.id === id || event.id === `${id}-forming`);
const stable = (game: GameState) => own(game, 'stableStar') + own(game, 'redDwarf') > 0;
const stableQueued = (game: GameState) => game.cosmos.protostars.some(star => star.kind !== 'massiveStar');
const massiveBegun = (game: GameState) => pending(game, 'massiveStar') > 0 || game.stars.length > 0 || ever(game, 'massiveStar') || game.stats.supernovae > 0;
const hasLineage = (game: GameState, id: string) => BIO_IDS.slice(BIO_IDS.indexOf(id)).some(key => own(game, key) > 0);
const world = (cardId: string, label: string): NavigationTarget => ({ phase: 0, view: 'world', cardId, label });

/** A short learning route derived entirely from real progress. It never grants,
 * spends, hides, or locks anything, and needs no tutorial state in a save. */
export function getLearningJourney(game: GameState): LearningJourney {
  const mature = stable(game);
  const seeded = mature || stableQueued(game) || game.cosmos.discoveries.includes('fusion');
  const enriched = game.stats.supernovae > 0 || game.cosmos.discoveries.includes('enrichment') || own(game, 'planet') > 0;
  const alive = game.phase >= 1 || own(game, 'abiogenesis') > 0;
  const human = game.phase >= 2 || own(game, 'humans') > 0;

  function purchase(id: string, lesson: string, count = 1, skip = false, name?: string): Lesson {
    const definition = DEFINITION_MAP[id];
    const heading = name ?? (count > 1 ? `${definition.name} · ${count} total` : definition.name);
    const done = skip || own(game, id) >= count || (id === 'stableStar' && seeded) || (id === 'massiveStar' && massiveBegun(game));
    return {
      id: `${id}-${count}`, name: heading, done,
      create: () => {
        const cost = quote(game, id);
        const milestone: Milestone = { id, name: heading, description: definition.description, cost, missing: requirements(game, id), progress: mean(Object.entries(cost).map(([key, value]) => ratio(game.resources[key as ResourceId], value!))) };
        return { ...milestone, lesson, actionId: id, kind: 'purchase', target: recommendNextStep(game, milestone), ...(count > 1 ? { count: { current: own(game, id), target: count } } : {}) };
      },
    };
  }

  function condition(id: string, name: string, lesson: string, values: Array<{ name: string; value: number; target: number }>, target: NavigationTarget, skip = false, action?: Action): Lesson {
    return {
      id, name, done: skip || values.every(value => value.value >= value.target),
      create: () => ({ id, name, lesson, description: lesson, cost: {},
        missing: values.filter(value => value.value < value.target).map(value => `${value.name}: ${fmt(value.value)} / ${fmt(value.target)}% (missing ${fmt(value.target - value.value)}%).`),
        progress: mean(values.map(value => ratio(value.value, value.target))), target, kind: 'condition',
        ...(action ? { action, actionId: action.type } : {}),
      }),
    };
  }

  function cloudReady(id: 'stableStar' | 'massiveStar', skip: boolean): Lesson {
    const values = (EXTRA_REQUIREMENTS[id] ?? []).flatMap(requirement => requirement.kind === 'condition'
      ? [{ name: requirement.id === 'density' ? 'Cloud density' : 'Radiative cooling', value: conditionValue(game, requirement.id), target: requirement.amount }] : []);
    const item = condition(`${id}-conditions`, 'Let gravity prepare the cloud', 'Dense, cool gas can collapse into a star; these scores rise while a cloud exists.', values, world('stellar-nursery', 'Watch your gas cloud'), skip);
    const create = item.create;
    item.create = () => ({ ...create(), kind: 'wait' });
    return item;
  }

  function ignition(kind: 'stableStar' | 'massiveStar', skip: boolean): Lesson {
    const name = kind === 'stableStar' ? 'Feed your first protostar' : 'Feed the massive protostar';
    return { id: `${kind}-ignition`, name, done: skip || (kind === 'stableStar' ? mature : game.stars.length > 0), create: () => {
      const star = game.cosmos.protostars.find(value => kind === 'stableStar' ? value.kind !== 'massiveStar' : value.kind === kind);
      return {
        id: `${kind}-ignition`, name, description: 'A forming star needs a steady supply of hydrogen.', lesson: 'Keep hydrogen flowing until the core can sustain fusion.', cost: {}, kind: 'wait',
        progress: star ? ratio(star.total - star.remaining, star.total) : 0,
        missing: [star ? `${fmt(protostarSeconds(game, star))} seconds of fed formation remain; needs ${BALANCE.protostarHydrogen} hydrogen/s.` : 'Choose a star to start its formation.', ...bottlenecks(game).filter(message => message.includes('Hydrogen') || message.includes('Protostars'))],
        target: world('stellar-nursery', 'Watch your star form'),
      };
    } };
  }

  function reserves(id: string, name: string, lesson: string, cost: Cost, target: NavigationTarget, skip = false): Lesson {
    return { id, name, done: skip || Object.entries(cost).every(([key, value]) => game.resources[key as ResourceId] >= value!), create: () => ({
      id, name, lesson, description: lesson, cost, kind: 'wait', target,
      progress: mean(Object.entries(cost).map(([key, value]) => ratio(game.resources[key as ResourceId], value!))),
      missing: [...Object.entries(cost).flatMap(([key, value]) => {
        const resource = key as ResourceId;
        return game.resources[resource] < value! ? [`${RESOURCES[resource].name}: ${fmt(game.resources[resource])} / ${fmt(value!)} (missing ${fmt(value! - game.resources[resource])}).`] : [];
      }), ...bottlenecks(game)],
    }) };
  }

  const gather: Lesson = {
    id: 'gather-first-hydrogen', name: 'Gather 15 hydrogen', done: game.resources.hydrogen >= 15 || own(game, 'collector') > 0 || seeded,
    create: () => ({ id: 'gather-first-hydrogen', name: 'Gather 15 hydrogen', description: 'Your first collector costs 15 hydrogen.', lesson: 'Hydrogen is the raw material for your first automatic collector.', cost: {}, kind: 'gather', actionId: 'gather', action: { type: 'gather' },
      progress: ratio(game.resources.hydrogen, 15), missing: [`Hydrogen: ${fmt(game.resources.hydrogen)} / 15 (missing ${fmt(Math.max(0, 15 - game.resources.hydrogen))}).`], count: { current: game.resources.hydrogen, target: 15 },
      target: { phase: 0, view: 'build', cardId: 'gather-hydrogen', label: 'Gather hydrogen' },
    }),
  };
  const enrichment: Lesson = { id: 'stellar-enrichment', name: 'Wait for the first supernova', done: enriched, create: () => {
    const remaining = game.stars.length ? Math.min(...game.stars.map(star => star.remaining)) : BALANCE.massiveLifetime;
    return { id: 'stellar-enrichment', name: 'Wait for the first supernova', description: 'Massive stars release planetary ingredients once, then are consumed.', lesson: 'The explosion releases elements made during stellar life, plus some made in the blast.', cost: {}, kind: 'wait', progress: ratio(BALANCE.massiveLifetime - remaining, BALANCE.massiveLifetime),
      missing: [`Supernova in ${fmt(remaining)} seconds; releases 90 carbon, 110 oxygen, and 80 other elements.`], target: world('stellar-nursery', 'Watch the massive star'),
    };
  } };
  const habitat: Lesson = purchase('tidalPools', 'Prebiotic habitats improve chemistry; any of the three settings works.', 1, HABITAT_IDS.some(id => own(game, id) > 0), 'Develop a prebiotic habitat');
  const strategy: Lesson = purchase('metabolism', 'Efficiency lowers resource demand; faster reproduction is an equally valid first choice.', 1, own(game, 'reproduction') > 0, 'Improve efficiency or reproduction');
  const healthy = (id: string, target: number, skip = false) => condition(id, `Support a ${target}% healthy biosphere`, 'Healthy ecosystems support both biological growth and human civilization.', [{ name: 'Biosphere health', value: game.health, target }], { phase: game.phase, view: 'world', cardId: 'biosphere-care', label: 'Tend the biosphere' }, skip, { type: 'restore' });

  const conditions = (EXTRA_REQUIREMENTS.abiogenesis ?? []).flatMap(requirement => requirement.kind === 'condition'
    ? [{ name: ({ temperature: 'Thermal balance', waterCoverage: 'Water coverage', atmosphere: 'Atmospheric protection', nutrients: 'Nutrients' } as Record<string, string>)[requirement.id], value: conditionValue(game, requirement.id), target: requirement.amount }]
    : requirement.kind === 'habitability' ? [{ name: 'Habitability', value: game.habitability, target: requirement.amount }] : []);

  const chapters: Chapter[] = [
    { name: 'Gather & automate', complete: seeded || enriched || alive, lessons: [
      gather,
      purchase('collector', 'A collector gathers hydrogen every second, even while you visit another screen.'),
      purchase('collector', 'More collectors let you build while hydrogen keeps flowing.', 3),
      purchase('collection', 'Collection research strengthens automation and each manual tap.'),
      purchase('cloud', 'Gravity brings your collected gas together into a stellar nursery.'),
      cloudReady('stableStar', seeded),
      purchase('stableStar', 'Choose sustained fusion to power a future world; a small stable star also works.'),
      ignition('stableStar', enriched),
    ] },
    { name: 'Stars make ingredients', complete: enriched || alive, lessons: [
      reserves('first-helium', 'Accumulate 20 helium', 'Your star turns hydrogen into helium automatically under stellar conditions.', { helium: 20 }, world('stellar-nursery', 'See stellar fusion'), massiveBegun(game)),
      purchase('collector', 'A larger hydrogen supply supports fusion, chemistry, and the next generation of stars.', 6, massiveBegun(game)),
      purchase('cloud', 'A second cloud can become a short-lived massive star while your stable star persists.', 1, massiveBegun(game)),
      cloudReady('massiveStar', massiveBegun(game)),
      purchase('massiveStar', 'Trade a delayed burst of planetary elements for the gas and helium invested now.'),
      ignition('massiveStar', enriched), enrichment,
    ] },
    { name: 'Build a living world', complete: alive, lessons: [
      purchase('planet', 'Rocky planets assemble from the elements released by stars.'),
      ...COSMIC_PROJECT_IDS.map((id, index) => purchase(id, [
        'A rocky interior provides the foundation and mineral reservoir for your world.',
        'A solid surface gives water and chemistry a place to collect.',
        'An atmosphere protects the surface and helps keep conditions stable.',
        'Oceans begin producing water and prebiotic compounds from stellar ingredients.',
      ][index])),
      purchase('pond', 'Wetlands increase water and prebiotic production before life begins.'),
      habitat,
      purchase('stellarAutomation', 'Authorize a repeating cloud and massive-star cycle to replenish planetary ingredients.'),
      condition('life-conditions', 'Prepare a habitable home', 'Water, atmosphere, nutrients, and suitable temperatures develop together; stabilization is free.', conditions, world('planet-environment', 'Support planetary conditions'), false, { type: 'stabilize' }),
      reserves('life-reserves', 'Build the chemical reserves for life', 'Planetary chemistry needs time and a continuing supply of elemental ingredients.', quote(game, 'abiogenesis'), world('planet-environment', 'Watch planetary chemistry')),
      purchase('abiogenesis', 'Simple cells begin the biosphere; the exact origin of life remains an open scientific question.'),
    ] },
    { name: 'Grow a food web', complete: human || hasLineage(game, 'animals'), lessons: [
      purchase('collector', 'The growing biosphere still depends on hydrogen supplied by the cosmic system.', 10, hasLineage(game, 'eukaryotes')),
      purchase('collection', 'Improve the supply that feeds every earlier planetary process.', 2, hasLineage(game, 'eukaryotes')),
      purchase('pond', 'More chemistry supports living populations without exhausting their inputs.', 3, hasLineage(game, 'eukaryotes')),
      purchase('colony', 'Each colony makes biomass and abstract evolution points while using water and compounds.', 2, hasLineage(game, 'eukaryotes')),
      purchase('photosynthesis', 'Light-capturing organisms support productive ecosystems and future consumers.'),
      purchase('producer', 'Producer habitats supply biomass and the food-web support that animal lineages will need.', 2, hasLineage(game, 'eukaryotes')),
      strategy,
      purchase('eukaryotes', 'Endosymbiosis establishes cellular partnerships and increases evolution-point output.'),
      purchase('colony', 'Expand the persistent microbial foundation before building more complex life.', 7, hasLineage(game, 'multicellular')),
      purchase('metabolism', 'Lower input demand lets a larger biosphere grow on the same planetary chemistry.', 3, hasLineage(game, 'multicellular')),
      purchase('reproduction', 'Faster reproduction increases output, with greater water and prebiotic demand.', 3, hasLineage(game, 'multicellular')),
      purchase('population', 'Habitat expansion raises the output of every established lineage.', 3, hasLineage(game, 'multicellular')),
      purchase('multicellular', 'Cooperating cells unlock new forms of life while earlier organisms persist.'),
      purchase('animals', 'Consumers need a productive photosynthetic food web underneath them.'),
    ] },
    { name: 'A branching biosphere', complete: human, lessons: [
      purchase('producer', 'More consumers need more photosynthetic support.', 3, hasLineage(game, 'vertebrates')),
      purchase('vertebrates', 'One animal branch develops the ancestors of vertebrates.'),
      purchase('producer', 'Terrestrial food webs need a wider base of primary producers.', 4, hasLineage(game, 'land')),
      purchase('land', 'Terrestrial adaptations open a new environment, with continuing water and nutrient demand.'),
      purchase('producer', 'A richer producer base supports the next consumer lineage.', 5, hasLineage(game, 'mammals')),
      purchase('mammals', 'Mammalian lineages add ecological diversity; the earlier food web remains active.'),
      purchase('producer', 'Expand food-web support before another consumer branch appears.', 6, hasLineage(game, 'primates')),
      purchase('primates', 'Social learning and flexible behavior develop along this selected ancestral branch.'),
      purchase('producer', 'Human communities need a substantial living ecosystem underneath them.', 8),
      healthy('human-health', 50),
      purchase('humans', 'Humans begin civilization while remaining dependent on the biosphere; this is one evolutionary route.'),
    ] },
    { name: 'Support a settlement', complete: game.completed || own(game, 'industry') > 0, lessons: [
      purchase('workshop', 'Workshops convert planetary elements and biomass into construction materials.'),
      purchase('agriculture', 'Cultivation improves food production while depending on soil, water, and ecosystems.'),
      purchase('farm', 'A food surplus lets people grow; farms still need a healthy biosphere.', 4, own(game, 'writing') > 0),
      purchase('house', 'Food and housing together determine how many people your settlement can support.', 4, own(game, 'writing') > 0),
      purchase('workshop', 'More material production supports schools, restoration, and later infrastructure.', 5, own(game, 'writing') > 0),
      purchase('writing', 'Recorded knowledge unlocks educational infrastructure.'),
      purchase('school', 'Schools let more people generate the knowledge needed for research.', 5),
      purchase('restoration', 'Restoration makes recovery continuous before industrial pollution increases.', 3),
      purchase('conservation', 'Conservation strengthens restoration and reduces industrial pressure.'),
      purchase('industry', 'Industry doubles material output but adds pressure to biosphere health.'),
    ] },
    { name: 'A civilization among the stars', complete: game.completed, lessons: [
      purchase('power', 'Power stations turn biomass into usable energy until clean energy is researched.', 4, own(game, 'electricity') > 0),
      purchase('electricity', 'Electric networks improve energy generation and industrial output.'),
      purchase('cleanEnergy', 'Clean energy removes biomass fuel demand and sharply reduces power-station pollution.'),
      purchase('computing', 'Computing increases collective knowledge production for the final research steps.'),
      purchase('spaceflight', 'Spaceflight unlocks an observatory, while the living planet must remain healthy.'),
      healthy('observatory-health', 60),
      purchase('observatory', 'Build the observatory with at least 60% biosphere health to complete the journey.'),
    ] },
  ];

  for (const chapter of chapters) {
    if (chapter.complete) continue;
    const index = chapter.lessons.findIndex(item => !item.done);
    if (index < 0) continue;
    const current = chapter.lessons[index].create();
    return { chapter: chapter.name, step: index + 1, total: chapter.lessons.length, current,
      upcoming: chapter.lessons.slice(index + 1).filter(item => !item.done).map(({ id, name }) => ({ id, name })),
    };
  }

  const complete = nextMilestone(game);
  return { chapter: 'Your connected world', step: 1, total: 1,
    current: { ...complete, lesson: complete.description, kind: 'wait', target: recommendNextStep(game, complete) }, upcoming: [],
  };
}
