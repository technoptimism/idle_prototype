export type ResourceId = 'hydrogen' | 'helium' | 'carbon' | 'oxygen' | 'elements' | 'water' | 'prebiotic' | 'biomass' | 'evolution' | 'food' | 'materials' | 'knowledge' | 'energy'
export type Phase = 0 | 1 | 2
export type Cost = Partial<Record<ResourceId, number>>
export type PlanetProfile = 'balanced' | 'oceanic' | 'active' | 'mineral'
export type StarKind = 'redDwarf' | 'stableStar' | 'massiveStar'
export type DiscoveryId = 'cloud' | 'fusion' | 'enrichment' | 'ocean' | 'waterCycle'
export interface Condition { id: string; name: string; value: number; target: number }
export interface WorldEffects { water: number; prebiotic: number; biomass: number; evolution: number; food: number; materials: number; demand: number; pollution: number }

export interface GameState {
  version: 2
  resources: Record<ResourceId, number>
  buildings: Record<string, number>
  upgrades: Record<string, number>
  phase: Phase
  elapsed: number
  health: number
  habitability: number
  population: number
  populations: Record<string, number>
  stars: Array<{ id: number; remaining: number }>
  cosmos: {
    density: number
    cooling: number
    nextStarId: number
    protostars: Array<{ id: number; kind: StarKind; remaining: number; total: number }>
    discoveries: DiscoveryId[]
  }
  planet: { profile: PlanetProfile; temperature: number; waterCoverage: number; atmosphere: number; nutrients: number }
  history: Array<{ id: string; name: string; time: number }>
  stats: { taps: number; supernovae: number; totalHydrogen: number }
  completed: boolean
  completedAt: number | null
  lastSaved: number
  automation: boolean
}

export interface Definition {
  id: string
  name: string
  phase: Phase
  description: string
  effect: string
  cost: Cost
  requires?: string[]
  discoveries?: DiscoveryId[]
  lineageParent?: string
  ecologicalRequires?: string[]
  repeatable?: boolean
  max?: number
  icon?: string
}

export type Action =
  | { type: 'gather' }
  | { type: 'fuse' }
  | { type: 'buy'; id: string }
  | { type: 'automation'; enabled: boolean }
  | { type: 'profile'; profile: PlanetProfile }
  | { type: 'stabilize' }
  | { type: 'restore' }
  | { type: 'observe' }

export interface Milestone {
  id: string
  name: string
  description: string
  cost: Cost
  missing: string[]
  progress: number
}

export type ExtraRequirement =
  | { kind: 'building'; id: string; amount: number }
  | { kind: 'habitability' | 'health'; amount: number }
  | { kind: 'condition'; id: 'density' | 'cooling' | 'temperature' | 'waterCoverage' | 'atmosphere' | 'nutrients'; amount: number }
