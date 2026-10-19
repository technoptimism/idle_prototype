export * from './types'
export * from './data'

import type { Action, Condition, Cost, Definition, DiscoveryId, GameState, Milestone, Phase, ResourceId, StarKind, WorldEffects } from './types'
import { BALANCE, BIO_IDS, BUILDING_IDS, COSMIC_PROJECT_IDS, DEFINITION_MAP, DISCOVERIES, EXTRA_REQUIREMENTS, HABITAT_IDS, PROFILE_DEFINITIONS, RESOURCES, STAR_IDS, TECHNOLOGY_IDS } from './data'

const resourceIds = Object.keys(RESOURCES) as ResourceId[]
const resourceLimit = 1e15
const epsilon = 1e-8
const own = (state: GameState, id: string) => BUILDING_IDS.has(id) ? (state.buildings[id] || 0) : (state.upgrades[id] || 0)
const unlocked = (state: GameState, id: string) => id === 'stableStar' ? own(state, 'stableStar') + own(state, 'redDwarf') > 0 : own(state, id) > 0
export const pending = (state: GameState, id: string) => state.cosmos.protostars.filter(star => star.kind === id).length
const purchasedCount = (state: GameState, id: string) => own(state, id) + pending(state, id)
const clamp = (n: number, low = 0, high = resourceLimit) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : 0))
const amount = (n: number) => n >= 1000 ? Math.ceil(n).toLocaleString('en-US') : Number(n.toFixed(1)).toLocaleString('en-US')

function clone(state: GameState): GameState {
  return { ...state, resources: { ...state.resources }, buildings: { ...state.buildings }, upgrades: { ...state.upgrades }, populations: { ...state.populations }, stars: state.stars.map(star => ({ ...star })), history: state.history.map(event => ({ ...event })), stats: { ...state.stats }, cosmos: { ...state.cosmos, protostars: state.cosmos.protostars.map(star => ({ ...star })), discoveries: [...state.cosmos.discoveries] }, planet: { ...state.planet } }
}

export function createGame(now = Date.now()): GameState {
  return {
    version: 2,
    resources: Object.fromEntries(resourceIds.map(id => [id, 0])) as Record<ResourceId, number>,
    buildings: {}, upgrades: {}, phase: 0, elapsed: 0,
    health: 100, habitability: 0, population: 0, populations: {}, stars: [],
    cosmos: { density: 0, cooling: 0, nextStarId: 1, protostars: [], discoveries: [] },
    planet: { profile: 'balanced', temperature: 0, waterCoverage: 0, atmosphere: 0, nutrients: 0 },
    history: [{ id: 'beginning', name: 'A cloud of possibility', time: 0 }],
    stats: { taps: 0, supernovae: 0, totalHydrogen: 0 },
    completed: false, completedAt: null, lastSaved: now, automation: false,
  }
}

/** Construction stages are inferred from actual purchased projects, never from the selected tab. */
export function planetStage(state: GameState): number {
  if (!own(state, 'planet')) return 0
  let stage = 1
  for (const id of COSMIC_PROJECT_IDS) { if (!own(state, id)) break; stage += 1 }
  return stage
}

const conditionNames: Record<string, string> = {
  density: 'Cloud density', cooling: 'Radiative cooling', temperature: 'Thermal balance',
  waterCoverage: 'Water coverage', atmosphere: 'Atmospheric protection', nutrients: 'Nutrient availability',
}
const conditionName = (id: string) => conditionNames[id] || id
export function conditionValue(state: GameState, id: string): number {
  if (id === 'density' || id === 'cooling') return state.cosmos[id]
  return state.planet[id as 'temperature' | 'waterCoverage' | 'atmosphere' | 'nutrients'] || 0
}
function definitionConditions(state: GameState, id: string): Condition[] {
  return (EXTRA_REQUIREMENTS[id] || []).flatMap(requirement => requirement.kind === 'condition'
    ? [{ id: requirement.id, name: conditionName(requirement.id), value: conditionValue(state, requirement.id), target: requirement.amount }] : [])
}
export function cloudConditions(state: GameState): Condition[] {
  return definitionConditions(state, 'stableStar')
}
export function planetConditions(state: GameState): Condition[] {
  return definitionConditions(state, 'abiogenesis')
}

/** Remaining game seconds at full hydrogen supply, accounting for researched formation speed. */
export function protostarSeconds(state: GameState, star: GameState['cosmos']['protostars'][number]): number {
  return star.remaining / (state.upgrades.stellarSurvey ? BALANCE.stellarFormationSpeed : 1)
}

/** All modifiers apply to existing resource recipes; traits never create a separate economy. */
export function worldEffects(state: GameState): WorldEffects {
  const effects = { ...PROFILE_DEFINITIONS.find(profile => profile.id === state.planet.profile)!.effects }
  const u = (id: string) => own(state, id)
  if (!u('land') || u('climateRegulation')) effects.demand = 1
  if (state.planet.profile === 'active' && u('climateRegulation')) effects.pollution = 1
  if (state.planet.profile === 'mineral' && u('nutrientCycling')) effects.food = 1
  if (u('climateRegulation')) effects.demand *= BALANCE.climateDemand
  if (u('nutrientCycling')) { effects.biomass *= BALANCE.nutrientOutput; effects.food *= BALANCE.nutrientOutput }
  effects.prebiotic *= 1 + u('tidalPools') * BALANCE.tidalPoolsPrebiotic + u('mineralSurfaces') * BALANCE.mineralSurfacesPrebiotic + u('oceanVents') * BALANCE.oceanVentsPrebiotic
  effects.water *= 1 + u('mineralSurfaces') * BALANCE.mineralSurfacesWater
  const diversity = 1 + HABITAT_IDS.filter(id => u(id)).length * BALANCE.habitatDiversity
  effects.biomass *= diversity
  effects.evolution *= diversity * (u('oceanVents') ? BALANCE.oceanVentsEvolution : 1)
  return effects
}

function discover(state: GameState, id: DiscoveryId) {
  if (state.cosmos.discoveries.includes(id)) return
  state.cosmos.discoveries.push(id)
  addHistory(state, `discovery-${id}`, `Discovery · ${DISCOVERIES[id].name}`)
}

/** The cost of the next purchase, including repeatable scaling. No resource is spent here. */
export function quote(state: GameState, id: string): Cost {
  const definition = DEFINITION_MAP[id]
  if (!definition) return {}
  const extraPlanet = id === 'planet' && own(state, 'planet') > 0
  const factor = (BALANCE.scales[id] || 1) ** (extraPlanet ? own(state, 'planet') - 1 : purchasedCount(state, id))
  return Object.fromEntries(Object.entries(extraPlanet ? BALANCE.extraPlanetCost : definition.cost).map(([resource, cost]) => [resource, Math.ceil(cost! * factor)])) as Cost
}

function prerequisiteMessages(state: GameState, definition: Definition): string[] {
  const missing: string[] = []
  if (state.phase < definition.phase) missing.push(`Reach ${definition.phase === 1 ? 'the living world' : 'civilization'} first.`)
  if (!definition.repeatable && own(state, definition.id)) missing.push('Already completed.')
  if (definition.max !== undefined && purchasedCount(state, definition.id) >= definition.max) missing.push(`Maximum ${definition.max} reached.`)
  if (definition.id === 'planet' && own(state, 'planet') && planetStage(state) < 5) missing.push('Complete the primary world’s core, surface, atmosphere, and oceans before assembling another planet.')
  for (const discovery of definition.discoveries || []) if (!state.cosmos.discoveries.includes(discovery)) missing.push(`Discover ${DISCOVERIES[discovery].name.toLowerCase()} first. ${DISCOVERIES[discovery].description}`)
  for (const id of definition.requires || []) {
    if (!unlocked(state, id)) missing.push(id === 'stableStar' ? 'Requires a mature stable star (small or Sun-like).' : `Requires ${DEFINITION_MAP[id]?.name || id}.`)
  }
  for (const requirement of EXTRA_REQUIREMENTS[definition.id] || []) {
    if (requirement.kind === 'building') {
      const have = own(state, requirement.id)
      if (have < requirement.amount) missing.push(`Requires ${requirement.amount} × ${DEFINITION_MAP[requirement.id]?.name || requirement.id} (have ${have}; missing ${requirement.amount - have}).`)
    } else if (requirement.kind === 'condition') {
      const value = conditionValue(state, requirement.id)
      if (value + epsilon < requirement.amount) missing.push(`Requires ${requirement.amount}% ${conditionName(requirement.id).toLowerCase()} (now ${amount(value)}%; missing ${amount(requirement.amount - value)}%).`)
    } else if (state[requirement.kind] + epsilon < requirement.amount) {
      missing.push(`Requires ${requirement.amount}% ${requirement.kind === 'health' ? 'biosphere health' : 'habitability'} (now ${amount(state[requirement.kind])}%; missing ${amount(requirement.amount - state[requirement.kind])}%).`)
    }
  }
  return missing
}

/** Every disabled purchase has readable, touch-accessible reasons, including exact missing costs. */
export function requirements(state: GameState, id: string): string[] {
  const definition = DEFINITION_MAP[id]
  if (!definition) return ['Unknown purchase.']
  const missing = prerequisiteMessages(state, definition)
  for (const [key, required] of Object.entries(quote(state, id))) {
    const resource = key as ResourceId
    const have = state.resources[resource]
    if (have + epsilon < required!) missing.push(`Needs ${amount(required!)} ${RESOURCES[resource].name.toLowerCase()} (have ${amount(have)}; missing ${amount(required! - have)}).`)
  }
  return missing
}

export function available(state: GameState, id: string): boolean {
  return requirements(state, id).length === 0
}

function addHistory(state: GameState, id: string, name: string) {
  state.history.push({ id, name, time: state.elapsed })
  // Keep milestones forever; collapse only old repeated supernova messages.
  const repeatEvents = state.history.filter(event => event.id.startsWith('supernova-'))
  if (repeatEvents.length > 30) {
    const earliest = repeatEvents[0]
    state.history = state.history.filter(event => event !== earliest)
  }
}

function spend(state: GameState, cost: Cost): boolean {
  const entries = Object.entries(cost) as Array<[ResourceId, number]>
  if (entries.some(([id, value]) => !Number.isFinite(value) || value < 0 || state.resources[id] + epsilon < value)) return false
  for (const [id, value] of entries) state.resources[id] = Math.max(0, state.resources[id] - value)
  return true
}

function buyInto(state: GameState, id: string): boolean {
  if (!available(state, id)) return false
  const definition = DEFINITION_MAP[id]
  if (!spend(state, quote(state, id))) return false
  const isBuilding = BUILDING_IDS.has(id)
  const record = isBuilding ? state.buildings : state.upgrades
  const first = !state.history.some(event => event.id === id)
  if (STAR_IDS.includes(id as StarKind)) {
    state.buildings.cloud -= 1
    const total = BALANCE.starFormationSeconds[id as StarKind]
    state.cosmos.protostars.push({ id: state.cosmos.nextStarId++, kind: id as StarKind, remaining: total, total })
    if (first && !state.history.some(event => event.id === `${id}-forming`)) addHistory(state, `${id}-forming`, `${definition.name} · protostar forming`)
    return true
  }
  record[id] = (record[id] || 0) + 1
  if (id === 'cloud') {
    state.cosmos.density += BALANCE.cloudInitialDensity
    state.cosmos.cooling += BALANCE.cloudInitialCooling
    discover(state, 'cloud')
  }
  if (id === 'compression') state.cosmos.density += BALANCE.cloudResearchBoost
  if (id === 'radiativeCooling') state.cosmos.cooling += BALANCE.cloudResearchBoost
  if (id === 'planet' && first) state.planet.temperature = 25
  if (id === 'planetCore') state.planet.nutrients = Math.max(25, state.planet.nutrients)
  if (id === 'planetSurface') { state.planet.temperature = Math.max(40, state.planet.temperature); state.planet.nutrients = Math.max(40, state.planet.nutrients) }
  if (id === 'planetAtmosphere') state.planet.atmosphere = Math.max(35, state.planet.atmosphere)
  if (id === 'planetOceans') {
    state.habitability = Math.max(35, state.habitability)
    state.planet.waterCoverage = Math.max(35, state.planet.waterCoverage)
    discover(state, 'ocean')
  }
  if (id === 'stellarAutomation') state.automation = true
  if (id === 'abiogenesis') {
    state.phase = 1
    state.health = 92
    state.buildings.colony = (state.buildings.colony || 0) + 1
    state.resources.biomass += 35
    state.populations.abiogenesis = 100
  }
  if (BIO_IDS.includes(id) && id !== 'abiogenesis') {
    state.populations[id] = id === 'humans' ? 12 : Math.max(3, 200 / (BIO_IDS.indexOf(id) + 1))
  }
  if (id === 'humans') {
    state.phase = 2
    state.population = 12
    state.buildings.house = (state.buildings.house || 0) + 1
    state.resources.food += 80
    state.resources.materials += 50
    state.resources.knowledge += 30
  }
  if (id === 'observatory') {
    state.completed = true
    state.completedAt = state.elapsed
  }
  if (first || !isBuilding) addHistory(state, id, definition.name + (definition.repeatable && !isBuilding ? ` · level ${record[id]}` : ''))
  return true
}

/** Actions are atomic. A failed action returns the original state without partial spending. */
export function act(state: GameState, action: Action): GameState {
  if (!action || typeof action !== 'object') return state
  if (action.type === 'buy' && !available(state, action.id)) return state
  if (action.type === 'fuse' && (!unlocked(state, 'stableStar') || state.resources.hydrogen < BALANCE.manualFusionCost)) return state
  if (action.type === 'automation' && !unlocked(state, 'stellarAutomation')) return state
  if (action.type === 'restore' && state.phase < 1) return state
  if (action.type === 'observe' && state.phase < 2) return state
  if (action.type === 'profile' && !PROFILE_DEFINITIONS.some(profile => profile.id === action.profile)) return state
  if (action.type === 'stabilize' && !state.buildings.planet) return state
  const next = clone(state)
  switch (action.type) {
    case 'gather': {
      const value = BALANCE.tap + (state.upgrades.collection || 0)
      next.resources.hydrogen += value
      next.stats.totalHydrogen += value
      next.stats.taps += 1
      break
    }
    case 'fuse':
      spend(next, { hydrogen: BALANCE.manualFusionCost })
      next.resources.helium += BALANCE.manualFusionOutput * (1 + (state.upgrades.fusion || 0) * 0.35)
      discover(next, 'fusion')
      break
    case 'buy':
      if (!buyInto(next, action.id)) return state
      break
    case 'automation':
      next.automation = action.enabled
      break
    case 'profile':
      next.planet.profile = action.profile
      break
    case 'stabilize':
      if (planetStage(next) >= 3) { next.planet.temperature += BALANCE.stabilizeConditions; next.planet.nutrients += BALANCE.stabilizeConditions }
      if (planetStage(next) >= 4) next.planet.atmosphere += BALANCE.stabilizeConditions
      if (planetStage(next) >= 5) next.planet.waterCoverage += BALANCE.stabilizeWater
      break
    case 'restore':
      next.health = Math.min(100, next.health + BALANCE.manualRestoration)
      break
    case 'observe':
      next.resources.knowledge += 0.65 * (1 + (state.upgrades.writing || 0) * 0.35)
      break
    default:
      return state
  }
  sanitize(next)
  return next
}

/** Applies a recipe in proportion to its scarcest available input. Units are rates per second. */
function recipe(state: GameState, inputs: Cost, outputs: Cost, units: number, seconds: number): number {
  if (!(units > 0 && seconds > 0)) return 0
  let fraction = 1
  for (const [key, demand] of Object.entries(inputs)) {
    if (demand! > 0) fraction = Math.min(fraction, state.resources[key as ResourceId] / (demand! * units * seconds))
  }
  fraction = clamp(fraction, 0, 1)
  const totalUnits = units * seconds * fraction
  for (const [key, demand] of Object.entries(inputs)) state.resources[key as ResourceId] = Math.max(0, state.resources[key as ResourceId] - demand! * totalUnits)
  for (const [key, output] of Object.entries(outputs)) state.resources[key as ResourceId] += output! * totalUnits
  return fraction
}

interface ProductionResult { biologySupply: number; foodSupply: number; ecosystemSupport: number; chemistrySupply: number }

/** Population is descriptive ecosystem abundance, not individual-agent simulation. */
function production(state: GameState, seconds: number): ProductionResult {
  const b = (id: string) => state.buildings[id] || 0
  const u = (id: string) => state.upgrades[id] || 0
  const world = worldEffects(state)
  const hydrogen = b('collector') * BALANCE.collector * (1 + u('collection') * 0.5) * seconds
  state.resources.hydrogen += hydrogen
  state.stats.totalHydrogen += hydrogen
  // Feeding consumes available hydrogen proportionally; a shortage pauses maturation safely.
  for (const protostar of state.cosmos.protostars) {
    const speed = u('stellarSurvey') ? BALANCE.stellarFormationSpeed : 1
    const feedingSeconds = Math.min(seconds, protostar.remaining / speed)
    const feed = recipe(state, { hydrogen: BALANCE.protostarHydrogen }, {}, 1, feedingSeconds)
    protostar.remaining = Math.max(0, protostar.remaining - feedingSeconds * feed * speed)
  }
  const fusionOutput = (1 + u('fusion') * 0.35) * (u('stellarSurvey') ? BALANCE.stellarSurveyHelium : 1)
  const stableFusion = recipe(state, { hydrogen: BALANCE.fusionHydrogen }, { helium: BALANCE.fusionHelium * fusionOutput }, b('stableStar'), seconds)
  const dwarfFusion = recipe(state, { hydrogen: BALANCE.redDwarfHydrogen }, { helium: BALANCE.redDwarfHelium * fusionOutput }, b('redDwarf'), seconds)
  if ((b('stableStar') && stableFusion > 0) || (b('redDwarf') && dwarfFusion > 0)) discover(state, 'fusion')

  let chemistrySupply = 0
  if (planetStage(state) >= 5 && unlocked(state, 'stableStar')) {
    const planetaryBonus = 1 + (b('planet') - 1) * 0.15
    const light = b('stableStar') ? Math.min(1.5, 1 + (b('stableStar') + b('redDwarf') - 1) * 0.1) : BALANCE.redDwarfLight
    const waterCapacity = (BALANCE.planetWater + b('pond') * BALANCE.pondWater) * planetaryBonus * light * world.water
    const prebioticCapacity = (BALANCE.planetPrebiotic + b('pond') * BALANCE.pondPrebiotic) * planetaryBonus * light * world.prebiotic
    const waterSupply = recipe(state, BALANCE.waterInputs, { water: 1 }, waterCapacity, seconds)
    const prebioticSupply = recipe(state, BALANCE.prebioticInputs, { prebiotic: 1 }, prebioticCapacity, seconds)
    chemistrySupply = Math.min(waterSupply, prebioticSupply)
  }

  const healthFactor = 0.2 + state.health * 0.008
  const consumerStage = u('humans') ? 7 : u('primates') ? 6 : u('mammals') ? 5 : u('land') ? 4 : u('vertebrates') ? 3 : u('animals') ? 2 : 0
  const consumerDemand = consumerStage + (state.phase === 2 ? state.population / 40 : 0)
  const ecosystemSupport = consumerDemand > 0 ? clamp(b('producer') / consumerDemand, 0.15, 1) : 1
  let biologySupply = 1
  if (state.phase >= 1) {
    const reproduction = 1.18 ** u('reproduction')
    const efficiency = 1 + u('metabolism') * 0.05
    const expansion = 1 + u('population') * 0.12
    const demand = 1.22 ** u('reproduction') * 0.85 ** u('metabolism') * (1 + u('population') * 0.08) * world.demand
    const biologicalOutput = reproduction * efficiency * expansion * healthFactor
    const biomassBonus = (u('photosynthesis') ? 1.25 : 1) * (u('multicellular') ? 1.25 : 1) * (u('land') ? 1.25 : 1)
    const diversity = 1 + BIO_IDS.filter(id => u(id)).length * 0.1
    const evolutionBonus = diversity * ecosystemSupport
      * (u('eukaryotes') ? 1.3 : 1) * (u('multicellular') ? 1.25 : 1)
      * (u('animals') ? 1.35 : 1) * (u('vertebrates') ? 1.25 : 1)
      * (u('land') ? 1.25 : 1) * (u('mammals') ? 1.3 : 1) * (u('primates') ? 1.3 : 1)
    const colonySupply = recipe(state,
      { water: BALANCE.colonyWater * demand, prebiotic: BALANCE.colonyPrebiotic * demand },
      { biomass: BALANCE.colonyBiomass * biologicalOutput * biomassBonus * world.biomass, evolution: BALANCE.colonyEvolution * biologicalOutput * evolutionBonus * world.evolution },
      b('colony'), seconds)
    const producerSupply = recipe(state,
      { water: BALANCE.producerWater * demand },
      { biomass: BALANCE.producerBiomass * biologicalOutput * biomassBonus * world.biomass, evolution: BALANCE.producerEvolution * biologicalOutput * evolutionBonus * world.evolution },
      b('producer'), seconds)
    biologySupply = b('producer') ? Math.min(colonySupply, producerSupply) : colonySupply
  }

  let foodSupply = 1
  if (state.phase === 2) {
    // Ecosystem food is an abstraction of edible biomass; farms improve its harvest.
    state.resources.food += b('producer') * 0.055 * healthFactor * (u('agriculture') ? 1.25 : 1) * world.food * seconds
    recipe(state, { water: BALANCE.farmWater, biomass: BALANCE.farmBiomass }, { food: BALANCE.farmFood * healthFactor * world.food }, b('farm'), seconds)
    foodSupply = recipe(state, { food: BALANCE.foodPerPerson }, {}, state.population, seconds)
    const workers = Math.min(1, state.population / Math.max(1, (b('workshop') + b('farm') + b('school') + b('power')) * 2))
    const labor = workers * (0.25 + foodSupply * 0.75)
    const industrialBonus = (u('industry') ? 2 : 1) * (u('electricity') ? 1.25 : 1)
    recipe(state, { elements: BALANCE.workshopElements, biomass: BALANCE.workshopBiomass }, { materials: BALANCE.workshopMaterials * industrialBonus * labor * world.materials }, b('workshop'), seconds)
    const educated = Math.min(state.population, b('school') * 12)
    const knowledge = (state.population * BALANCE.baseKnowledge + educated * BALANCE.schoolKnowledge)
      * (u('writing') ? 1.35 : 1) * (u('computing') ? 2 : 1) * (0.25 + foodSupply * 0.75)
    state.resources.knowledge += knowledge * seconds
    recipe(state, u('cleanEnergy') ? {} : { biomass: BALANCE.powerBiomass },
      { energy: (u('electricity') ? BALANCE.electricEnergy : BALANCE.powerEnergy) * (u('cleanEnergy') ? 1.25 : 1) * labor }, b('power'), seconds)
  }
  return { biologySupply, foodSupply, ecosystemSupport, chemistrySupply }
}

function updateConditions(state: GameState, seconds: number, result: ProductionResult) {
  const b = (id: string) => state.buildings[id] || 0
  const u = (id: string) => state.upgrades[id] || 0
  if (b('cloud')) {
    state.cosmos.density += BALANCE.cloudDensityRate * (1 + u('compression') * BALANCE.cloudResearchGain) * seconds
    state.cosmos.cooling += BALANCE.cloudCoolingRate * (1 + u('radiativeCooling') * BALANCE.cloudResearchGain) * seconds
  }
  if (unlocked(state, 'stableStar')) {
    const stage = planetStage(state)
    const climate = u('climateRegulation') ? BALANCE.climateConditions : 1
    const rate = BALANCE.conditionRate * climate * seconds
    if (stage >= 3) {
      state.planet.temperature += rate * BALANCE.thermalConditions
      state.planet.nutrients += rate * (u('nutrientCycling') ? BALANCE.nutrientConditions : 1)
    }
    if (stage >= 4) state.planet.atmosphere += rate
    if (stage >= 5) {
      state.planet.waterCoverage += rate * result.chemistrySupply * worldEffects(state).water
      state.habitability += BALANCE.habitabilityRate * (1 + b('pond') * 0.08) * result.chemistrySupply * seconds
      if (planetConditions(state).every(condition => condition.value >= BALANCE.waterCycleThreshold)) discover(state, 'waterCycle')
    }
  }
  if (state.phase >= 1) {
    const naturalRecovery = u('photosynthesis') ? 0.008 + b('producer') * 0.002 : 0.003
    const restoration = b('restoration') * BALANCE.restorationRecovery * (u('conservation') ? 2 : 1)
    const shortagePressure = (1 - result.biologySupply) * 0.035 + (1 - result.ecosystemSupport) * 0.025
    const industry = u('industry') ? b('workshop') * BALANCE.workshopPollution * (u('conservation') ? 0.5 : 1) : 0
    const power = b('power') * BALANCE.powerPollution * (u('cleanEnergy') ? 0.1 : 1)
    state.health += (naturalRecovery + restoration - shortagePressure - (industry + power) * worldEffects(state).pollution) * seconds
    const output = result.biologySupply * (0.2 + clamp(state.health, 0, 100) * 0.008)
    for (const [index, id] of BIO_IDS.entries()) {
      if (!u(id) || id === 'humans') continue
      const habitat = id === 'photosynthesis' ? b('producer') : b('colony')
      const target = (habitat + 1) * (1 + u('population') * 0.25) * 2500 / (index + 1) ** 1.4
      const current = state.populations[id] || 1
      if (current < target) state.populations[id] = current + (target - current) * Math.min(1, seconds * 0.006 * output)
    }
  }
  if (state.phase === 2) {
    const capacity = 12 + b('house') * 12
    if (result.foodSupply >= 0.999 && state.resources.food > 2 && state.population < capacity) {
      state.population += BALANCE.populationGrowth * state.population * (1 - state.population / capacity) * seconds
    }
    state.population = Math.min(capacity, state.population)
    state.populations.humans = state.population
  }
}

function igniteProtostars(state: GameState) {
  const ignited = state.cosmos.protostars.filter(star => star.remaining <= epsilon)
  for (const star of ignited) {
    state.buildings[star.kind] = (state.buildings[star.kind] || 0) + 1
    if (star.kind === 'massiveStar') state.stars.push({ id: star.id, remaining: BALANCE.massiveLifetime })
    else discover(state, 'fusion')
    if (!state.history.some(event => event.id === star.kind)) addHistory(state, star.kind, `${DEFINITION_MAP[star.kind].name} · ignition`)
  }
  state.cosmos.protostars = state.cosmos.protostars.filter(star => star.remaining > epsilon)
}

function stellarEvents(state: GameState, seconds: number) {
  for (const star of state.stars) star.remaining -= seconds
  const matured = state.stars.filter(star => star.remaining <= epsilon)
  if (!matured.length) return
  for (const star of matured) {
    for (const [id, value] of Object.entries(BALANCE.supernovaYield)) state.resources[id as ResourceId] += value!
    state.stats.supernovae += 1
    discover(state, 'enrichment')
    addHistory(state, `supernova-${star.id}`, 'Supernova · stellar elements released')
  }
  state.stars = state.stars.filter(star => star.remaining > epsilon)
  state.buildings.massiveStar = state.stars.length
}

function authorizedAutomation(state: GameState) {
  if (!state.automation || !unlocked(state, 'stellarAutomation') || state.stars.length + pending(state, 'massiveStar') >= BALANCE.autoStarLimit) return
  // Authorization is restricted to the advertised nursery recipe. No other upgrade/building is auto-bought.
  if (!state.buildings.cloud) {
    const cloudCost = quote(state, 'cloud')
    const starCost = quote(state, 'massiveStar')
    const combined: Cost = { hydrogen: (cloudCost.hydrogen || 0) + (starCost.hydrogen || 0), helium: starCost.helium || 0 }
    if (Object.entries(combined).every(([id, value]) => state.resources[id as ResourceId] + epsilon >= value!)) buyInto(state, 'cloud')
  }
  if (state.buildings.cloud) buyInto(state, 'massiveStar')
}

function sanitize(state: GameState) {
  for (const id of resourceIds) state.resources[id] = clamp(state.resources[id] || 0)
  state.health = clamp(state.health, 0, 100)
  state.habitability = clamp(state.habitability, 0, 100)
  state.population = clamp(state.population)
  state.elapsed = clamp(state.elapsed)
  state.stats.totalHydrogen = clamp(state.stats.totalHydrogen)
  state.cosmos.density = clamp(state.cosmos.density, 0, 100)
  state.cosmos.cooling = clamp(state.cosmos.cooling, 0, 100)
  for (const key of ['temperature', 'waterCoverage', 'atmosphere', 'nutrients'] as const) state.planet[key] = clamp(state.planet[key], 0, 100)
  for (const id of Object.keys(state.populations)) state.populations[id] = clamp(state.populations[id])
}

/** Pure elapsed-time simulation. One-second integration is shared by foreground and offline play. */
export function tick(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state
  const next = clone(state)
  let remaining = Math.min(seconds, BALANCE.maxOfflineSeconds)
  // A restored timer may sit exactly on zero; resolve it once before advancing.
  stellarEvents(next, 0)
  igniteProtostars(next)
  while (remaining > epsilon) {
    // Never carry a stellar death over the end of a substep. Its elements become
    // available to planetary chemistry for the remainder of this same interval.
    const formationSpeed = next.upgrades.stellarSurvey ? BALANCE.stellarFormationSpeed : 1
    const collectionRate = (next.buildings.collector || 0) * BALANCE.collector * (1 + (next.upgrades.collection || 0) * 0.5)
    const ignitionTimes = next.cosmos.protostars
      .filter(star => next.resources.hydrogen >= star.remaining / formationSpeed * BALANCE.protostarHydrogen || collectionRate >= BALANCE.protostarHydrogen * next.cosmos.protostars.length)
      .map(star => star.remaining / formationSpeed)
    const eventTime = Math.min(Infinity, ...next.stars.map(star => star.remaining), ...ignitionTimes)
    const step = Math.min(BALANCE.simulationStep, remaining, eventTime)
    next.elapsed += step
    const result = production(next, step)
    updateConditions(next, step, result)
    stellarEvents(next, step)
    igniteProtostars(next)
    authorizedAutomation(next)
    sanitize(next)
    remaining -= step
  }
  return next
}

/** Net resource rates at current supply. Timed supernova bursts and purchases are excluded. */
export function rates(state: GameState): Record<ResourceId, number> {
  const next = clone(state)
  production(next, 1)
  return Object.fromEntries(resourceIds.map(id => [id, next.resources[id] - state.resources[id]])) as Record<ResourceId, number>
}

export function bottlenecks(state: GameState): string[] {
  const messages: string[] = []
  const flow = rates(state)
  const probe = clone(state)
  const supply = production(probe, 1)
  if ((unlocked(state, 'stableStar') || state.cosmos.protostars.length) && state.resources.hydrogen < 5 && flow.hydrogen <= 0) messages.push('Hydrogen is limiting fusion or chemistry. Add collectors, improve collection, or gather hydrogen.')
  if (state.buildings.planet && !unlocked(state, 'stableStar')) messages.push('Planetary chemistry needs a stable star.')
  if (planetStage(state) >= 5 && supply.chemistrySupply < 0.99) messages.push('Planetary chemistry lacks hydrogen, carbon, oxygen, or other elements. A massive-star cycle replenishes heavy elements.')
  if (state.cosmos.protostars.length && state.resources.hydrogen < 2) messages.push('Protostars need hydrogen to mature: 0.65 hydrogen/s each. Their progress pauses during a shortage; add collectors or gather hydrogen.')
  if (state.buildings.planet && planetStage(state) < 5) messages.push('Finish the primary world’s core, surface, atmosphere, and oceans to start planetary chemistry.')
  if (state.phase >= 1 && supply.biologySupply < 0.99) messages.push('Cells lack water or prebiotic compounds. Add chemical wetlands or develop efficient metabolism; growth slows safely.')
  if (state.phase >= 1 && supply.ecosystemSupport < 0.99) messages.push('Consumers need more photosynthetic producers. Add producer habitats to restore evolution output and food-web support.')
  if (state.phase >= 1 && state.health < 60) messages.push('Biosphere health is reducing production. Tend the biosphere freely, add restoration, or develop conservation and clean energy.')
  if (state.phase === 2) {
    if (supply.foodSupply < 0.99 || (flow.food < 0 && state.resources.food < 30)) messages.push('Food is limiting population growth. Add farms or producer habitats and restore biosphere health.')
    if (state.population >= (12 + (state.buildings.house || 0) * 12) * 0.95) messages.push('Housing is nearly full. Build housing to let the population grow.')
    if ((state.buildings.workshop || 0) && state.resources.elements < 2 && flow.materials < 0.1) messages.push('Workshops need other elements. Form massive stars or enable your authorized stellar nursery.')
    if (!(state.buildings.school || 0)) messages.push('Writing unlocks schools. Education increases the knowledge produced by your population.')
  }
  return messages
}

export function nextMilestone(state: GameState): Milestone {
  let id: string
  if (state.completed) return { id: 'completed', name: 'A living civilization among the stars', description: 'The Orbital Observatory is complete. Your connected world keeps growing.', cost: {}, missing: [], progress: 1 }
  const forming = (kinds: StarKind[]): Milestone | undefined => {
    const star = state.cosmos.protostars.find(value => kinds.includes(value.kind))
    if (!star) return
    return { id: 'protostar', name: `${DEFINITION_MAP[star.kind].name} forming`, description: 'A collapsing protostar must keep accreting hydrogen before sustained fusion begins.', cost: {}, progress: 1 - star.remaining / star.total, missing: [`${amount(protostarSeconds(state, star))} seconds of fed maturation remaining; requires ${BALANCE.protostarHydrogen} hydrogen/s. Shortages pause progress safely.`] }
  }
  if (!state.buildings.collector) id = 'collector'
  else if (!unlocked(state, 'stableStar')) {
    const waiting = forming(['redDwarf', 'stableStar'])
    if (waiting) return waiting
    id = state.buildings.cloud ? 'stableStar' : 'cloud'
  } else if (!state.buildings.planet) {
    if (!state.stats.supernovae) {
      const waiting = forming(['massiveStar'])
      if (waiting) return waiting
      if (state.stars.length) {
        const remaining = Math.min(...state.stars.map(star => star.remaining))
        return { id: 'enrichment', name: 'Await stellar enrichment', description: 'A massive star forms elements during its life. A supernova releases those ingredients plus some made in the explosion.', cost: {}, progress: 1 - remaining / BALANCE.massiveLifetime, missing: [`Next supernova in ${amount(remaining)} seconds; releases 90 carbon, 110 oxygen, and 80 other elements.`] }
      }
      id = state.buildings.cloud ? 'massiveStar' : 'cloud'
    } else id = 'planet'
  } else if (planetStage(state) < 5) id = COSMIC_PROJECT_IDS.find(key => !state.upgrades[key])!
  else if (!state.upgrades.abiogenesis) id = 'abiogenesis'
  else if (state.phase === 1) id = BIO_IDS.find(key => !state.upgrades[key]) || 'humans'
  else id = TECHNOLOGY_IDS.find(key => !state.upgrades[key]) || 'observatory'
  const definition = DEFINITION_MAP[id]
  const cost = quote(state, id)
  const progressParts = Object.entries(cost).map(([key, value]) => clamp(state.resources[key as ResourceId] / value!, 0, 1))
  for (const required of definition.requires || []) progressParts.push(unlocked(state, required) ? 1 : 0)
  for (const discovery of definition.discoveries || []) progressParts.push(state.cosmos.discoveries.includes(discovery) ? 1 : 0)
  for (const required of EXTRA_REQUIREMENTS[id] || []) {
    const value = required.kind === 'building' ? own(state, required.id) : required.kind === 'condition' ? conditionValue(state, required.id) : state[required.kind]
    progressParts.push(clamp(value / required.amount, 0, 1))
  }
  return { id, name: definition.name, description: definition.description, cost, missing: requirements(state, id), progress: progressParts.reduce((sum, value) => sum + value, 0) / Math.max(1, progressParts.length) }
}

/** Isolated developer starts; the UI stores these in a separate save slot. */
export function preset(phase: Phase): GameState {
  if (phase === 0) return createGame()
  let state = createGame()
  state.resources = Object.fromEntries(resourceIds.map(id => [id, 100_000])) as Record<ResourceId, number>
  const purchase = (id: string, count = 1) => { for (let n = 0; n < count; n++) state = act(state, { type: 'buy', id }) }
  state.cosmos.density = 100; state.cosmos.cooling = 100
  purchase('collector', 8); purchase('collection', 2); purchase('cloud'); purchase('stableStar'); state = tick(state, 20); purchase('cloud'); purchase('massiveStar'); state = tick(state, 120); purchase('planet')
  for (const id of COSMIC_PROJECT_IDS) purchase(id)
  purchase('pond', 2)
  purchase('stellarAutomation')
  if (phase >= 1) {
    state.habitability = 80
    state.planet = { ...state.planet, temperature: 80, waterCoverage: 80, atmosphere: 80, nutrients: 80 }
    purchase('abiogenesis'); purchase('colony', 4)
  }
  if (phase >= 2) {
    for (const id of BIO_IDS.slice(1)) {
      if (id === 'animals') purchase('producer', 8)
      purchase(id)
    }
    purchase('workshop', 3); purchase('house', 2); purchase('agriculture'); purchase('farm', 3)
  }
  const remaining: Cost = phase === 1 ? { hydrogen: 1200, helium: 250, carbon: 90, oxygen: 100, elements: 100, water: 120, prebiotic: 60, biomass: 120, evolution: 15 }
      : { hydrogen: 5000, helium: 1200, carbon: 400, oxygen: 500, elements: 350, water: 300, prebiotic: 150, biomass: 1500, evolution: 500, food: 150, materials: 150, knowledge: 60, energy: 0 }
  state.resources = Object.fromEntries(resourceIds.map(id => [id, remaining[id] || 0])) as Record<ResourceId, number>
  state.phase = phase
  state.elapsed = phase === 1 ? 600 : 1500
  state.health = 90
  return state
}
