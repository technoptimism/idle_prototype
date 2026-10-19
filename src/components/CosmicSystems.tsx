import { Check, ChevronRight, Circle, Droplets, Globe2, Orbit, Sparkles, Wind } from 'lucide-react';
import {
  BALANCE, DEFINITION_MAP, DISCOVERIES, DISCOVERY_IDS, PROFILE_DEFINITIONS, RESOURCES, UPGRADES,
  cloudConditions, planetConditions, planetStage, protostarSeconds, quote, rates, requirements, worldEffects,
} from '../game';
import type { Action, Cost, GameState, Phase, ResourceId } from '../game';
import './cosmic-systems.css';

type Props = { game: GameState; phase: Phase; dispatch: (action: Action) => unknown };
type Condition = { id: string; name: string; value: number; target: number };

const stages = [
  { id: 'planet', name: 'Accretion disk', short: 'Disk', effect: 'Begins your primary world.' },
  { id: 'planetCore', name: 'Rocky core', short: 'Core', effect: 'Builds the interior of your world.' },
  { id: 'planetSurface', name: 'Solid surface', short: 'Surface', effect: 'Unlocks free condition recovery.' },
  { id: 'planetAtmosphere', name: 'Atmosphere', short: 'Air', effect: 'Develops atmospheric protection.' },
  { id: 'planetOceans', name: 'Oceans', short: 'Oceans', effect: 'Activates water and prebiotic production.' },
];
const fmt = (n: number, digits = 1) => Number(n.toFixed(digits)).toLocaleString('en-US');
const percent = (n: number) => Math.min(100, Math.max(0, n));
const effectNames: Record<string, string> = { water: 'Water', prebiotic: 'Chemistry', biomass: 'Biomass', evolution: 'Evolution', food: 'Food', materials: 'Materials', demand: 'Demand', pollution: 'Pollution' };
const profileBenefits: Record<string, string> = {
  balanced: 'Balanced production and resource demand.',
  oceanic: '+20% water · +12% biomass · higher land demand.',
  active: '+20% chemistry · +8% evolution · more pollution.',
  mineral: '+20% materials · lower starting food productivity.',
};

function ConditionMeter({ condition }: { condition: Condition }) {
  const ready = condition.value >= condition.target;
  return <div className={`cosmic-condition ${ready ? 'is-ready' : ''}`}>
    <div><span>{condition.name}</span><strong>{fmt(condition.value)}%</strong></div>
    <div className="cosmic-condition__track" role="meter" aria-label={condition.name} aria-valuenow={Math.round(condition.value)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${fmt(condition.value)}%; target ${fmt(condition.target)}%`}>
      <i style={{ width: `${percent(condition.value)}%` }} />
      <span style={{ left: `${percent(condition.target)}%` }} />
    </div>
  </div>;
}

function Costs({ cost, game }: { cost: Cost; game: GameState }) {
  return <div className="cosmic-costs" aria-label="Purchase cost">{Object.entries(cost).map(([id, value]) => {
    const resource = id as ResourceId;
    return <span className={game.resources[resource] >= value! ? 'affordable' : ''} key={id}>
      <b>{RESOURCES[resource].symbol}</b> {fmt(value!, 0)} <small>{RESOURCES[resource].name}</small>
    </span>;
  })}</div>;
}

function Construction({ game, dispatch }: Pick<Props, 'game' | 'dispatch'>) {
  const stage = planetStage(game);
  const next = stage < 5 ? stages[stage] : { id: 'planet', name: 'Additional rocky world', effect: '+15% planetary chemistry capacity.' };
  const def = DEFINITION_MAP[next.id];
  const missing = requirements(game, next.id);
  return <section className="cosmic-panel planet-construction" data-card-id="planet-construction" tabIndex={-1} aria-label="Planet construction">
    <div className="cosmic-panel__heading"><Globe2 size={17} /><h3>{stage === 5 ? 'Your planetary system' : 'Assemble your world'}</h3><span className="cosmic-panel__count">{stage === 5 ? `${game.buildings.planet ?? 0} / ${def.max} worlds` : `${stage} / 5`}</span></div>
    <ol className="construction-stages" aria-label="Planet construction stages">{stages.map((item, index) => <li className={index < stage ? 'is-complete' : index === stage ? 'is-next' : ''} key={item.id} aria-label={`${item.name}: ${index < stage ? 'complete' : index === stage ? 'next' : 'locked'}`}>
      <span className="construction-stages__number">{index < stage ? <Check size={11} /> : index + 1}</span><span>{item.short}</span>
    </li>)}</ol>
    <div className="construction-purchase">
      <div><h4>{next.name}</h4><p>{next.effect}</p></div>
      <Costs cost={quote(game, next.id)} game={game} />
      <button className="cosmic-action" disabled={missing.length > 0} onClick={() => dispatch({ type: 'buy', id: next.id })}>Build {next.name.toLowerCase()}<ChevronRight size={15} /></button>
    </div>
    <details className="cosmic-details"><summary>{missing.length ? `Requirements · ${missing.length} missing` : 'Project details'}</summary><p>{def.description}</p><p>{def.effect}</p>{missing.length > 0 && <ul>{missing.map((line, index) => <li key={index}>{line}</li>)}</ul>}</details>
  </section>;
}

function PlanetProfile({ game, dispatch }: Pick<Props, 'game' | 'dispatch'>) {
  const effects = worldEffects(game);
  const selected = PROFILE_DEFINITIONS.find(profile => profile.id === game.planet.profile)!;
  return <section className="cosmic-panel planet-profiles">
    <div className="cosmic-panel__heading"><Orbit size={17} /><h3>{selected.name}</h3></div>
    <p className="cosmic-one-line">{profileBenefits[selected.id]}</p>
    <details className="cosmic-details"><summary>Change world profile · free</summary>
      <div className="profile-grid">{PROFILE_DEFINITIONS.map(profile => <button key={profile.id} type="button" aria-pressed={profile.id === game.planet.profile} className={`profile-choice profile-choice--${profile.id} ${profile.id === game.planet.profile ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'profile', profile: profile.id })}>
        <span className="profile-choice__heading"><strong>{profile.name}</strong>{profile.id === game.planet.profile ? <Check size={14} /> : <Circle size={13} />}</span><span>{profileBenefits[profile.id]}</span>
      </button>)}</div>
      <p>Change freely; every profile supports the full journey.</p>
    </details>
    <details className="cosmic-details"><summary>Modifiers &amp; tradeoffs</summary>
      <p>{selected.description} {selected.tradeoff}</p>
      <div className="world-inheritance" aria-label="Current world modifiers including research">{Object.entries(effects).map(([id, value]) => <span key={id}>{effectNames[id]} ×{fmt(value, 2)}</span>)}</div>
      {PROFILE_DEFINITIONS.filter(profile => profile.id !== selected.id).map(profile => <p key={profile.id}><strong>{profile.name}:</strong> {profile.tradeoff}</p>)}
    </details>
  </section>;
}

function PlanetEnvironment({ game, dispatch }: Pick<Props, 'game' | 'dispatch'>) {
  const production = rates(game);
  const stage = planetStage(game);
  const conditions = planetConditions(game);
  const recovery = [
    stage >= 3 ? `+${BALANCE.stabilizeConditions}% thermal balance and nutrients` : '',
    stage >= 4 ? `+${BALANCE.stabilizeConditions}% atmosphere` : '',
    stage >= 5 ? `+${BALANCE.stabilizeWater}% water coverage` : '',
  ].filter(Boolean).join('; ');
  return <section className="cosmic-panel planetary-environment" data-card-id="planet-environment" tabIndex={-1} aria-label="Planetary conditions">
    <div className="cosmic-panel__heading"><Droplets size={17} /><h3>Planetary conditions</h3><span className="cosmic-panel__count">{fmt(game.habitability)}% habitable</span></div>
    <div className="cosmic-condition-grid">{conditions.map(condition => <ConditionMeter key={condition.id} condition={condition} />)}</div>
    <div className="planetary-inventory"><span>Water <strong>{fmt(game.resources.water)}</strong><small>{production.water >= 0 ? '+' : ''}{fmt(production.water, 2)}/s</small></span><span>Prebiotic <strong>{fmt(game.resources.prebiotic)}</strong><small>{production.prebiotic >= 0 ? '+' : ''}{fmt(production.prebiotic, 2)}/s</small></span></div>
    <div className="condition-recovery"><button className="secondary-button" disabled={stage < 3} onClick={() => dispatch({ type: 'stabilize' })}><Wind size={14} />Stabilize conditions · free</button><span>{stage < 3 ? 'Requires a solid surface.' : 'Recover conditions at any time.'}</span></div>
    <details className="cosmic-details"><summary>Thresholds &amp; recovery details</summary>
      <ul>{conditions.map(condition => <li key={condition.id}>{condition.name}: {fmt(condition.value)}% / {fmt(condition.target)}%{condition.value >= condition.target ? ' · met' : ` · ${fmt(condition.target - condition.value)}% missing`}</li>)}</ul>
      <p>{stage < 3 ? 'Build the solid surface to unlock stabilization.' : `${recovery} per action. Planetary processes also improve these conditions.`}</p><p>Markers show the first-cell thresholds. These scores are gameplay abstractions; thermal balance represents suitability for liquid water.</p>
    </details>
  </section>;
}

export default function CosmicSystems({ game, phase, dispatch }: Props) {
  const stage = planetStage(game);
  const hasClouds = (game.buildings.cloud ?? 0) > 0 || game.cosmos.discoveries.includes('cloud');
  const hasStellarProgress = hasClouds || game.cosmos.protostars.length > 0 || (game.buildings.stableStar ?? 0) > 0 || (game.buildings.redDwarf ?? 0) > 0;
  const hasElements = game.stats.supernovae > 0 || stage > 0 || game.resources.carbon > 0;
  if (!hasStellarProgress && !hasElements && game.cosmos.discoveries.length === 0) return <p className="cosmic-empty">Gather gas and build a cloud to begin shaping your world.</p>;
  return <div className="cosmic-systems" aria-label={phase > 0 ? 'Your inherited world' : 'Your star system'}>
    {hasStellarProgress && <section className="cosmic-panel stellar-nursery" data-card-id="stellar-nursery" tabIndex={-1} aria-label="Stellar nursery">
      <div className="cosmic-panel__heading"><Wind size={17} /><h3>Stellar nursery</h3><span className="cosmic-panel__count">{game.buildings.cloud ?? 0} clouds ready</span></div>
      <div className="cosmic-condition-grid">{cloudConditions(game).map(condition => <ConditionMeter key={condition.id} condition={condition} />)}</div>
      {game.cosmos.protostars.length > 0 && <div className="protostar-list">{game.cosmos.protostars.map(star => <div className="protostar-timer" key={star.id}>
        <strong>{DEFINITION_MAP[star.kind]?.name ?? star.kind}</strong><span>{fmt(protostarSeconds(game, star), 0)}s to ignition</span><div className="protostar-track" role="progressbar" aria-label={`${DEFINITION_MAP[star.kind]?.name ?? star.kind} formation`} aria-valuenow={Math.round(percent((1 - star.remaining / star.total) * 100))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent((1 - star.remaining / star.total) * 100)}%` }} /></div>
      </div>)}</div>}
      <details className="cosmic-details"><summary>Star formation details</summary><p>Gravity draws gas together. Cooling allows collapse; fusion begins under stellar conditions. The markers show Sun-like star thresholds.</p><ul>{cloudConditions(game).map(condition => <li key={condition.id}>{condition.name}: {fmt(condition.value)}% / {fmt(condition.target)}%{condition.value >= condition.target ? ' · met' : ` · ${fmt(condition.target - condition.value)}% missing`}</li>)}</ul><p>Each protostar uses {BALANCE.protostarHydrogen} hydrogen/s. Gas shortages slow growth without losing progress. Stellar times and quantities are gameplay abstractions.</p><p>Stable stars sustain production. Massive stars release elements made during stellar life, plus some formed in the supernova.</p></details>
    </section>}
    {hasElements && <><Construction game={game} dispatch={dispatch} /><PlanetProfile game={game} dispatch={dispatch} /></>}
    {stage > 0 && <PlanetEnvironment game={game} dispatch={dispatch} />}
    {game.cosmos.discoveries.length > 0 && <details className="cosmic-panel discovery-notebook"><summary><Sparkles size={16} /><span>Discovery notebook</span><small>{game.cosmos.discoveries.length} / {DISCOVERY_IDS.length}</small></summary><div className="discovery-trail">{DISCOVERY_IDS.map(id => {
      const observed = game.cosmos.discoveries.includes(id);
      const research = UPGRADES.filter(def => def.discoveries?.includes(id)).map(def => def.name).join(', ');
      return <div className={observed ? 'is-observed' : ''} key={id}><span>{observed ? <Check size={12} /> : <Circle size={12} />}</span><div><strong>{DISCOVERIES[id].name}</strong><small>{observed && research ? research : DISCOVERIES[id].description}</small></div></div>;
    })}</div></details>}
  </div>;
}
