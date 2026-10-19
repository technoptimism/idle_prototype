import { BALANCE } from './game';
import type { Definition } from './game';

/** Presentation only. Prices, production, and availability always come from the game. */
export function formatAmount(value: number, precision = 0): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('en-US', { maximumFractionDigits: precision });
}

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

/** Short benefit lines complement, rather than replace, the complete definition. */
export function briefEffect(def: Definition): string {
  const summaries: Record<string, string> = {
    collector: `+${BALANCE.collector} hydrogen/s`,
    cloud: 'Builds density and cooling. Seeds one star.',
    redDwarf: 'Low-cost helium production · weaker planetary support',
    stableStar: 'Steady helium production · full planetary support',
    massiveStar: `Element burst ${BALANCE.massiveLifetime}s after ignition`,
    planet: 'Start a rocky world · extra worlds improve capacity',
    planetCore: 'Stage 2 of 5 · unlock planetary nutrients',
    planetSurface: 'Stage 3 of 5 · develop surface conditions',
    planetAtmosphere: 'Stage 4 of 5 · protect the surface',
    planetOceans: 'Stage 5 of 5 · produce water and prebiotic compounds',
    pond: `+${BALANCE.pondWater} water/s · +${BALANCE.pondPrebiotic} prebiotic/s capacity`,
    colony: `+${BALANCE.colonyBiomass} biomass/s · +${BALANCE.colonyEvolution} evolution/s`,
    producer: 'More biomass, food-web support, and resilience',
    house: def.effect.split('. ')[0],
    farm: `+${BALANCE.farmFood} food/s · uses water and biomass`,
    workshop: `+${BALANCE.workshopMaterials} materials/s · uses elements and biomass`,
    school: 'Educate more people to produce knowledge',
    power: 'Produce energy from biomass · adds pollution',
    restoration: 'Restore biosphere health automatically',
    collection: `${def.effect.split(';')[0]} · stronger taps`,
    compression: 'Build cloud density faster',
    radiativeCooling: 'Cool clouds faster for stellar formation',
    stellarSurvey: 'Faster protostars · more helium',
    climateRegulation: 'Faster conditions · lower ecological demand',
    nutrientCycling: 'More biomass and food · faster nutrients',
    tidalPools: 'More prebiotic chemistry and biological output',
    mineralSurfaces: 'More chemistry, water, and biological output',
    oceanVents: 'More chemistry, evolution, and biological output',
    stellarAutomation: 'Automate cloud → massive star cycles',
    abiogenesis: 'Begin life with your first microbial colony',
    photosynthesis: 'Unlock producers · stronger food webs',
    eukaryotes: def.effect.split(';')[0],
    multicellular: def.effect.split(';')[0],
    animals: `${def.effect.split(';')[0]} · needs producers`,
    vertebrates: def.effect.replace(/\.$/, ''),
    land: def.effect.split(';')[0],
    mammals: def.effect.split(';')[0],
    primates: def.effect.split(';')[0],
    humans: 'Begin civilization with people and starting supplies',
    reproduction: `${def.effect.split(';')[0]} · greater resource demand`,
    metabolism: 'Use less water and prebiotic compounds · more output',
    population: def.effect.split(' and ')[0],
    agriculture: 'Unlock farms · more food from producers',
    writing: def.effect.replace(/\.$/, ''),
    industry: 'Double workshop output · adds pollution',
    electricity: 'Stronger power stations and workshops',
    computing: 'Double knowledge production',
    conservation: 'Stronger restoration · less industrial pollution',
    cleanEnergy: 'More energy · no biomass fuel · much less pollution',
    spaceflight: 'Reach the Space Age · unlock the Observatory',
    observatory: 'Complete your journey with a healthy biosphere',
  };
  if (summaries[def.id]) return summaries[def.id];
  const clause = def.effect.split(';')[0].replace(/\.$/, '');
  return clause.length > 100 ? `${clause.slice(0, 97).trimEnd()}…` : clause;
}

/** Keep one readable blocker nearby; Details retains every exact missing amount. */
export function shortRequirement(message: string): string {
  if (message.startsWith('Needs ')) {
    const missing = message.match(/^Needs [\d,.]+ (.*?) \(have .*?; missing ([\d,.]+)\)\.$/);
    return missing ? `Need ${missing[2]} more ${missing[1]}` : message.replace(/^Needs /, 'Need ').replace(/ \(.*$/, '').replace(/\.$/, '');
  }
  if (message.startsWith('Discover ')) return message.split('. ')[0].replace(/ first\.$/, '');
  if (message.startsWith('Requires a mature stable star')) return 'Requires a mature stable star';
  return message.replace(/ \(.*$/, '').replace(/ first\.$/, '').replace(/\.$/, '');
}
