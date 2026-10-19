import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Atom, Check, ChevronDown, CircleHelp, Clock3, Dna, FlaskConical,
  Globe2, Hammer, History, Leaf, LockKeyhole, Orbit, Plus, Save, Settings2,
  Telescope, Trash2, X, Zap,
} from 'lucide-react';
import {
  BALANCE, BIO_IDS, BUILDINGS, COSMIC_PROJECT_IDS, DEFINITION_MAP,
  RESOURCES, STAR_IDS, UPGRADES, bottlenecks, protostarSeconds,
  rates,
} from './game';
import type { Definition, GameState, Milestone, Phase, ResourceId } from './game';
import ActionCard, { CostTokens } from './components/ActionCard';
import CosmicSystems from './components/CosmicSystems';
import WorldScene from './components/WorldScene';
import { formatAmount as fmt, formatDuration as duration, shortRequirement } from './ui';
import { useGame } from './useGame';
import type { ActionView, NavigationTarget } from './navigation';
import { getLearningJourney } from './progression';

const PHASES = [
  { name: 'The cosmos', icon: Orbit, locked: '' },
  { name: 'Living world', icon: Dna, locked: 'First cells required' },
  { name: 'Civilization', icon: Globe2, locked: 'Humans required' },
];
const RESOURCE_GROUPS: ResourceId[][] = [
  ['hydrogen', 'helium', 'carbon', 'oxygen', 'elements'],
  ['biomass', 'evolution', 'water', 'prebiotic'],
  ['food', 'materials', 'knowledge', 'energy'],
];
const SCIENCE = [
  'Gravity collapses cooling gas into protostars. Fusion begins under stellar conditions. Massive stars release elements formed during their lives, plus some made in their final explosion. Units, lifetimes, and planetary controls are game abstractions.',
  'The origin of life remains an open scientific question. Pools, mineral surfaces, and vents represent possible environments. Evolution points are an abstract currency; evolution has no conscious intention. Humans are a selected branch, not an inevitable endpoint. Earlier lineages persist.',
  'Civilization depends on living ecosystems. Farms use water and biomass, workshops process planetary elements, and people generate knowledge. Industry pressures biosphere health; restoration and clean energy allow recovery.',
];

/** Presentation filtering only: every purchase is still validated by the economy. */
function readyToIntroduce(game: GameState, def: Definition) {
  return game.phase >= def.phase && (!STAR_IDS.some(id => id === def.id) || game.cosmos.discoveries.includes('cloud')) && (def.requires ?? []).every(id =>
    id === 'stableStar'
      ? (game.buildings.stableStar ?? 0) + (game.buildings.redDwarf ?? 0) > 0
      : (game.buildings[id] ?? 0) + (game.upgrades[id] ?? 0) > 0,
  ) && (def.discoveries ?? []).every(id => game.cosmos.discoveries.includes(id));
}

function Catalog({ defs, game, buy, upgrade = false }: {
  defs: Definition[]; game: GameState; buy: (id: string) => void; upgrade?: boolean;
}) {
  const complete = defs.filter(def => upgrade && !def.repeatable && game.upgrades[def.id] > 0);
  const active = defs.filter(def => !complete.includes(def) && readyToIntroduce(game, def));
  const upcoming = defs.filter(def => !complete.includes(def) && !active.includes(def));
  const cards = (items: Definition[]) => <div className="purchase-grid">{items.map(def =>
    <ActionCard key={def.id} def={def} game={game} buy={buy} upgrade={upgrade}/>,
  )}</div>;
  return <div className="action-catalog">
    {active.length > 0 ? cards(active) : <p className="empty-state">More options will open as your world develops.</p>}
    {upcoming.length > 0 && <details className="catalog-disclosure"><summary>Upcoming <span>{upcoming.length}</span><ChevronDown size={14}/></summary>{cards(upcoming)}</details>}
    {complete.length > 0 && <details className="catalog-disclosure completed-catalog"><summary>Completed <span>{complete.length}</span><ChevronDown size={14}/></summary>{cards(complete)}</details>}
  </div>;
}

function milestoneHint(milestone: Milestone) {
  const reason = milestone.missing[0];
  if (!reason) return 'Ready when you are.';
  if (milestone.id === 'protostar' || milestone.id === 'enrichment') return reason.split(';')[0];
  return shortRequirement(reason);
}

function shortageTitle(message: string) {
  if (/^(Hydrogen|Protostars)/.test(message)) return 'More hydrogen needed';
  if (message.startsWith('Planetary chemistry')) return 'Chemistry needs ingredients';
  if (message.startsWith('Cells')) return 'Water or compounds running low';
  if (message.startsWith('Consumers')) return 'More producers needed';
  if (message.startsWith('Biosphere')) return 'Biosphere needs care';
  if (message.startsWith('Food')) return 'More food needed';
  if (message.startsWith('Housing')) return 'Housing nearly full';
  if (message.startsWith('Workshops')) return 'Elements needed for materials';
  if (message.startsWith('Writing')) return 'Schools boost knowledge';
  return 'Check production';
}

function MilestoneInfo({ milestone, game }: { milestone: Milestone; game: GameState }) {
  return <div className="milestone-info">
    <p>{milestone.description}</p>
    {Object.entries(milestone.cost).length > 0 && <dl>{Object.entries(milestone.cost).map(([id, amount]) =>
      <div key={id}><dt>{RESOURCES[id as ResourceId].name}</dt><dd>{fmt(game.resources[id as ResourceId], 1)} / {fmt(amount!, 1)}</dd></div>,
    )}</dl>}
    {milestone.missing.length > 0 && <ul>{milestone.missing.map((line, index) => <li key={index}>{line}</li>)}</ul>}
  </div>;
}

export default function App() {
  const engine = useGame();
  const { game, dispatch } = engine;
  const [phase, setPhase] = useState<Phase>(game.phase);
  const [views, setViews] = useState<Record<Phase, ActionView>>({ 0: 'build', 1: 'build', 2: 'build' });
  const view = views[phase];
  const setView = (next: ActionView) => setViews(previous => ({ ...previous, [phase]: next }));
  const [navigationRequest, setNavigationRequest] = useState<(NavigationTarget & { sequence: number }) | null>(null);
  const navigationSequence = useRef(0);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceId | null>(null);
  const [tapId, setTapId] = useState(0);
  const [notice, setNotice] = useState('');
  const [milestoneVisible, setMilestoneVisible] = useState(true);
  const milestoneRef = useRef<HTMLElement>(null);
  const actionTabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const journey = getLearningJourney(game);
  const milestone = journey.current;
  const nextStep = milestone.target;
  const production = rates(game);
  const returnSummary = engine.returnSummary.replace(/^While you were away, your universe continued for (.*?)\. .*$/, '$1 of offline production.');
  const shortages = bottlenecks(game);
  const fusionYield = BALANCE.manualFusionOutput * (1 + (game.upgrades.fusion ?? 0) * 0.35);
  const knowledgeYield = 0.65 * (1 + (game.upgrades.writing ?? 0) * 0.35);
  const milestoneDefinition = milestone.actionId ? DEFINITION_MAP[milestone.actionId] : undefined;
  const canBuyMilestone = milestone.kind === 'purchase' && Boolean(milestoneDefinition) && !game.completed;
  const modalOpen = resetOpen || aboutOpen || completionOpen;

  useEffect(() => { setPhase(game.phase); }, [game.phase, engine.slot]);
  useEffect(() => { setSelectedResource(null); }, [phase, engine.slot]);
  useEffect(() => {
    setViews({ 0: 'build', 1: 'build', 2: 'build' });
    setNavigationRequest(null);
  }, [engine.slot]);
  useEffect(() => {
    if (!navigationRequest || navigationRequest.phase !== phase || navigationRequest.view !== view) return;
    const panel = document.getElementById(`panel-${view}`);
    const target = (navigationRequest.cardId && document.querySelector<HTMLElement>(`[data-card-id="${navigationRequest.cardId}"]`)) || panel;
    if (!target) return;
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    }
    if (navigationRequest.cardId) target.classList.add('guided-target');
    target.focus({ preventScroll: true });
    const scrollTarget = navigationRequest.cardId ? target : panel?.closest('.action-area') ?? target;
    scrollTarget.scrollIntoView({ block: 'start', behavior: 'instant' });
    return () => target.classList.remove('guided-target');
  }, [navigationRequest, phase, view]);
  useEffect(() => { if (game.completed) setCompletionOpen(true); }, [game.completed]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setMilestoneVisible(entries[0].isIntersecting), { threshold: 0.15 });
    if (milestoneRef.current) observer.observe(milestoneRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.code === 'KeyH' && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !modalOpen) {
        dispatch({ type: 'gather' }); setTapId(n => n + 1);
      }
      if (event.key === 'Escape') {
        setResetOpen(false); setAboutOpen(false); setCompletionOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, modalOpen]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const gather = () => { dispatch({ type: 'gather' }); setTapId(n => n + 1); };
  const buy = (id: string) => {
    const purchased = dispatch({ type: 'buy', id });
    const name = DEFINITION_MAP[id]?.name ?? id;
    setNotice(purchased ? STAR_IDS.some(kind => kind === id) ? `${name} forming` : `${name} established` : 'Supplies changed. Check Details.');
  };
  const resourceIds = RESOURCE_GROUPS[phase].filter(id => phase !== 0 || id === 'hydrogen' || game.resources[id] > 0 ||
    (id === 'helium' ? game.cosmos.discoveries.includes('fusion') : game.cosmos.discoveries.includes('enrichment')));
  const buildDefs = BUILDINGS.filter(def => def.phase === phase && def.id !== 'planet');
  const researchDefs = UPGRADES.filter(def => def.phase === phase && !COSMIC_PROJECT_IDS.includes(def.id));
  const tabs = [
    { id: 'build' as const, name: 'Build', icon: Hammer },
    { id: 'research' as const, name: 'Research', icon: FlaskConical },
    { id: 'world' as const, name: 'World', icon: Globe2 },
  ];
  const navigateTo = (target: NavigationTarget) => {
    setPhase(target.phase);
    setViews(previous => ({ ...previous, [target.phase]: target.view }));
    setNavigationRequest({ ...target, sequence: ++navigationSequence.current });
  };
  const selectActionTab = (index: number) => {
    setNavigationRequest(null);
    setView(tabs[index].id);
    actionTabsRef.current[index]?.focus();
  };

  return <div className={`app phase-${phase}`}>
    <header className="site-header">
      <a className="brand" href="#main" aria-label="Stardust to Civilization, skip to game"><span className="brand-mark"><Orbit size={25}/></span><span>Stardust <i>to</i><br/>Civilization</span></a>
      <div className="header-actions"><span className="run-clock"><Clock3 size={14}/>{duration(game.elapsed)}</span><button className="icon-button" onClick={() => engine.save()} aria-label="Save progress" title="Save progress"><Save size={18}/></button><button className="icon-button" onClick={() => setAboutOpen(true)} aria-label="How to play" title="How to play"><CircleHelp size={19}/></button></div>
    </header>
    {engine.slot === 'developer' && <div className="sandbox-banner"><FlaskConical size={15}/><strong>Developer universe</strong><span>{engine.speed}×</span><button onClick={() => engine.switchSlot('normal')}>Return to normal game <ArrowRight size={14}/></button></div>}
    <main id="main">
      <h1 className="sr-only">Stardust to Civilization</h1>
      <nav className="phase-nav" aria-label="Game chapters">{PHASES.map((item, index) => {
        const Icon = item.icon;
        const locked = index > game.phase;
        return <button key={item.name} className={phase === index ? 'active' : ''} aria-current={phase === index ? 'page' : undefined} disabled={locked} onClick={() => navigateTo({ phase: index as Phase, view: views[index as Phase], label: item.name })}>
          <Icon size={19}/><span>{item.name}{locked && <small>{item.locked}</small>}</span>{locked && <LockKeyhole size={13}/>}</button>;
      })}</nav>
      {engine.returnSummary && <div className="return-banner"><History size={17}/><div><strong>Welcome back to your universe.</strong><p>{returnSummary}</p></div><button className="icon-button" onClick={engine.dismissReturn} aria-label="Dismiss return summary"><X size={16}/></button></div>}
      {engine.storageBlocked && <div className="storage-banner" role="alert"><CircleHelp size={18}/><p>{engine.message}</p><button className="text-button" onClick={() => setResetOpen(true)}>Reset this slot</button></div>}
      <section className="resource-strip" aria-label="Resources">{resourceIds.map(id => <button key={id} className={`resource-stat ${selectedResource === id ? 'selected' : ''}`} aria-label={`${RESOURCES[id].name}, ${fmt(game.resources[id], 1)}. Show source and purpose.`} aria-expanded={selectedResource === id} onClick={() => setSelectedResource(selectedResource === id ? null : id)}>
        <span className="resource-label"><span className="element-symbol">{RESOURCES[id].symbol}</span>{RESOURCES[id].name}</span><strong className="resource-value">{fmt(game.resources[id], 1)}</strong><span className={`resource-rate ${production[id] < 0 ? 'negative' : ''}`}>{production[id] >= 0 ? '+' : ''}{fmt(production[id], 2)}/s</span>
      </button>)}</section>
      {selectedResource && <div className="resource-explanation"><p><strong>{RESOURCES[selectedResource].name}.</strong> {RESOURCES[selectedResource].description}</p><button className="icon-button" onClick={() => setSelectedResource(null)} aria-label="Close resource information"><X size={15}/></button></div>}
      {phase >= 1 && <div className="living-condition-bar" data-card-id="biosphere-care" tabIndex={-1} aria-label="Biosphere care"><Leaf size={15}/><span>Biosphere <strong>{game.health.toFixed(1)}%</strong></span><div className="health-track"><div style={{ width: `${game.health}%` }}/></div><button className="text-button" onClick={() => dispatch({ type: 'restore' })}>Tend biosphere · +{BALANCE.manualRestoration}%</button>{phase === 2 && <span className="people-summary">{fmt(game.population, 1)} people <small>/ {12 + (game.buildings.house ?? 0) * 12} housing</small></span>}</div>}

      <div className="game-layout">
        <div className="main-column">
          <section className="world-card" aria-label="Your evolving world">
            <h2 className="sr-only">{phase === 0 ? 'A universe in the making' : phase === 1 ? 'The beautiful complexity of life' : 'Our place among the stars'}</h2>
            <WorldScene phase={phase} state={game}/>
          </section>
          <div className="gather-row">
            <button className="gather-button" data-card-id="gather-hydrogen" onClick={gather} aria-label="Gather hydrogen"><Atom size={22}/><span><strong>Gather hydrogen</strong><small>+{BALANCE.tap + (game.upgrades.collection ?? 0)} per tap <kbd>H</kbd></small></span><Plus size={19}/>{tapId > 0 && <span className="tap-burst" key={tapId}>+H</span>}</button>
            {phase === 2 && <button className="observe-button" data-card-id="observe-knowledge" onClick={() => dispatch({ type: 'observe' })}><Telescope size={20}/><span>Observe · +{fmt(knowledgeYield, 2)} knowledge</span><Plus size={16}/></button>}
            {!game.buildings.collector && <span className="opening-tip">Start with 15 H for a collector.</span>}
          </div>
          {(game.cosmos.protostars.length > 0 || game.stars.length > 0) && <div className="active-processes" aria-label="Active stellar processes">
            {game.cosmos.protostars.map(star => <span key={`forming-${star.id}`}><span className="live-dot"/>{DEFINITION_MAP[star.kind].name} <strong>{fmt(protostarSeconds(game, star))}s</strong></span>)}
            {game.stars.length > 0 && <span><Zap size={13}/>{game.stars.length} massive {game.stars.length === 1 ? 'star' : 'stars'}<strong>{Math.ceil(Math.min(...game.stars.map(star => star.remaining)))}s to supernova</strong></span>}
          </div>}
          <section className="action-area" aria-label="Actions">
            <div className="action-tabs" role="tablist" aria-label="Game actions">{tabs.map((tab, index) => {
              const Icon = tab.icon;
              return <button key={tab.id} ref={el => { actionTabsRef.current[index] = el; }} id={`tab-${tab.id}`} role="tab" aria-selected={view === tab.id} aria-controls={`panel-${tab.id}`} tabIndex={view === tab.id ? 0 : -1} onClick={() => navigateTo({ phase, view: tab.id, label: tab.name })} onKeyDown={event => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); selectActionTab((index + (event.key === 'ArrowRight' ? 1 : 2)) % 3); }
                if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectActionTab(event.key === 'Home' ? 0 : 2); }
              }}><Icon size={16} aria-hidden="true"/>{tab.name}</button>;
            })}</div>
            <div id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`} className="action-panel" tabIndex={0}>
              {view === 'build' && <>
                <Catalog defs={buildDefs} game={game} buy={buy}/>
                {game.upgrades.stellarAutomation > 0 && <label className="automation-control"><input type="checkbox" checked={game.automation} onChange={event => dispatch({ type: 'automation', enabled: event.target.checked })}/><span>Automatic stars <small>Uses hydrogen + helium</small></span><strong>{game.automation ? 'On' : 'Paused'}</strong></label>}
                {(game.buildings.stableStar ?? 0) + (game.buildings.redDwarf ?? 0) > 0 && phase === 0 && <details className="manual-actions"><summary>Manual fusion<ChevronDown size={13}/></summary><p>Stars already fuse automatically.</p><button className="secondary-button" disabled={game.resources.hydrogen < BALANCE.manualFusionCost} onClick={() => dispatch({ type: 'fuse' })}><Zap size={14}/>Fuse {BALANCE.manualFusionCost} H → {fmt(fusionYield, 1)} He</button>{game.resources.hydrogen < BALANCE.manualFusionCost && <p>Need {fmt(BALANCE.manualFusionCost - game.resources.hydrogen, 1)} more hydrogen.</p>}</details>}
                {phase === 1 && <details className="ecosystem-details"><summary>Ecosystem <span>{Object.values(game.populations).filter(value => value > 0).length} lineages</span><ChevronDown size={13}/></summary><div className="population-chips">{Object.entries(game.populations).filter(([, value]) => value > 0).map(([id, value]) => <span key={id}>{DEFINITION_MAP[id]?.name ?? id}<strong>{fmt(value)}</strong></span>)}</div><p>Producers support consumers. Earlier lineages keep contributing.</p></details>}
              </>}
              {view === 'research' && <>
                <Catalog defs={researchDefs} game={game} buy={buy} upgrade/>
                {phase === 1 && <details className="evolution-overview"><summary>Evolution tree<ChevronDown size={13}/></summary><p>Selected ancestry and ecological support. Earlier lineages persist.</p><ol>{BIO_IDS.map(id => { const def = DEFINITION_MAP[id]; return <li key={id} className={game.upgrades[id] ? 'evolved' : ''}><span>{game.upgrades[id] ? <Check size={13}/> : <Dna size={13}/>}</span><div><strong>{def.name}</strong>{def.lineageParent && <small>From {DEFINITION_MAP[def.lineageParent].name}{def.ecologicalRequires?.length ? ' · supported by photosynthetic producers' : ''}</small>}</div></li>; })}</ol></details>}
              </>}
              {view === 'world' && <CosmicSystems game={game} phase={phase} dispatch={dispatch}/>}
            </div>
          </section>
        </div>
        <aside className="side-column">
          <section className="next-milestone" ref={milestoneRef}>
            <div className="milestone-label"><span>Next milestone</span><strong>{Math.floor(milestone.progress * 100)}%</strong></div>
            <div className="learning-introduction" aria-live="polite" aria-atomic="true">
              <p className="learning-chapter">{journey.chapter}<span>Step {journey.step} / {journey.total}</span></p>
              <h2>{milestone.name}</h2>
              <p className="milestone-benefit learning-lesson">{milestone.lesson}</p>
            </div>
            <CostTokens cost={milestone.cost} game={game}/>
            <div className="progress-track" role="progressbar" aria-label="Next milestone progress" aria-valuenow={Math.floor(milestone.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${milestone.progress * 100}%` }}/></div>
            {!game.completed && <p className="milestone-hint">{milestoneHint(milestone)}</p>}
            {canBuyMilestone && milestone.missing.length === 0 && <button className="milestone-button" aria-label={`Establish ${milestoneDefinition!.name}`} onClick={() => buy(milestone.actionId!)}>{BUILDINGS.some(def => def.id === milestone.actionId) ? 'Build' : 'Unlock'}<ArrowRight size={16}/></button>}
            {milestone.action && !game.completed && <button className="milestone-button" onClick={() => dispatch(milestone.action!)}>{milestone.action.type === 'restore' ? 'Tend biosphere' : milestone.action.type === 'stabilize' ? 'Stabilize conditions' : 'Enable automatic stars'}<ArrowRight size={16}/></button>}
            {!game.completed && <button className="next-step-button" onClick={() => navigateTo(nextStep)}>Show next step<ArrowRight size={16}/></button>}
            {!game.completed && <span className="next-step-location">{PHASES[nextStep.phase].name} / {tabs.find(tab => tab.id === nextStep.view)?.name}</span>}
            {game.completed && <button className="milestone-button" onClick={() => setCompletionOpen(true)}>View your journey<ArrowRight size={16}/></button>}
            <details className="milestone-details"><summary>Requirements & info<ChevronDown size={12}/></summary><MilestoneInfo milestone={milestone} game={game}/></details>
            {journey.upcoming.length > 0 && !game.completed && <details className="learning-route"><summary>Coming up<ChevronDown size={12}/></summary><ol>{journey.upcoming.slice(0, 3).map(step => <li key={step.id}>{step.name}</li>)}</ol></details>}
          </section>
          {shortages.length > 0 && <details className="bottleneck"><summary><CircleHelp size={15}/><span>{shortageTitle(shortages[0])}</span><strong>{shortages.length}</strong></summary><div>{shortages.map((line, index) => <p key={index}>{line}</p>)}</div></details>}
          <details className="history-card"><summary><History size={15}/>History<span>{game.history.length}</span><ChevronDown size={13}/></summary><ol>{game.history.slice(-6).reverse().map((item, index) => <li key={`${item.id}-${index}`}><strong>{item.name}</strong><small>{duration(item.time)}</small></li>)}</ol>{game.history.length > 6 && <details><summary>Full history</summary><ol>{game.history.slice(0, -6).reverse().map((item, index) => <li key={`${item.id}-${index}`}><strong>{item.name}</strong><small>{duration(item.time)}</small></li>)}</ol></details>}</details>
        </aside>
      </div>
      <footer><span className="save-status" role="status"><span className="live-dot"/>{engine.message}</span><details className="game-settings"><summary><Settings2 size={14}/>Settings</summary><div><button className="text-button" onClick={() => setDeveloperOpen(!developerOpen)}>Developer tools</button><button className="text-button reset-link" onClick={() => setResetOpen(true)}><Trash2 size={12}/>Reset progress</button></div></details></footer>
      {developerOpen && <section className="developer-panel"><div className="section-title"><h3>Developer sandbox</h3><button className="icon-button" onClick={() => setDeveloperOpen(false)} aria-label="Close developer tools"><X size={17}/></button></div><p>Separate save slot. Normal progress stays safe.</p><div className="developer-controls"><button className="secondary-button" onClick={() => engine.switchSlot(engine.slot === 'normal' ? 'developer' : 'normal')}>{engine.slot === 'normal' ? 'Enter developer universe' : 'Return to normal universe'}</button>{engine.slot === 'developer' && <><label>Speed<select value={engine.speed} onChange={event => engine.setSpeed(Number(event.target.value))}>{[1, 5, 20, 100].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><div className="preset-buttons">{PHASES.map((item, index) => <button className="secondary-button" key={item.name} onClick={() => { engine.startPreset(index as Phase); setViews({ 0: 'build', 1: 'build', 2: 'build' }); setNavigationRequest(null); setNotice(''); }}>{item.name} preset</button>)}</div></>}</div></section>}
    </main>
    {!milestoneVisible && !modalOpen && !game.completed && <button className="milestone-dock" onClick={() => navigateTo(nextStep)} aria-label="Go to next step"><span><small>Show next step · {Math.floor(milestone.progress * 100)}%</small><strong>{milestone.name}</strong></span><ArrowRight size={17}/></button>}
    {notice && <div className="purchase-toast" role="status"><Check size={16}/>{notice}</div>}
    {aboutOpen && <Modal title="How to play" close={() => setAboutOpen(false)}><ol className="quick-guide"><li>Gather hydrogen, then buy a collector.</li><li>Use Show next step to find the next action. Follow it from stars to civilization.</li><li>Build adds production; Research unlocks upgrades; World manages your planet. Switch chapters at the top. Open Details for exact requirements.</li><li>Keep biosphere health above 60% and build the Orbital Observatory.</li></ol><details className="help-details"><summary>Resources, recovery & saves</summary><p>Tap a resource for its source and purpose. Rates show continuous production; stellar bursts and nursery purchases are separate. Shortages slow production safely. Hydrogen gathering, tending the biosphere, and stabilizing your world remain available for recovery.</p><p>All phases keep producing. Progress saves every 10 seconds and when you leave. Offline production is capped at eight hours. Only enabled stellar automation makes purchases while away.</p></details><details className="help-details"><summary>Science notes</summary>{SCIENCE.map((text, index) => <p key={index}>{text}</p>)}</details><button className="primary-button" onClick={() => setAboutOpen(false)}>Begin exploring<ArrowRight size={16}/></button></Modal>}
    {resetOpen && <Modal title={`Reset ${engine.slot === 'normal' ? 'your universe' : 'the developer universe'}?`} close={() => setResetOpen(false)}><p>Permanently clear the <strong>{engine.slot}</strong> save slot on this device? The other slot is preserved.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setResetOpen(false)}>Keep exploring</button><button className="danger-button" onClick={() => { engine.reset(); setResetOpen(false); setPhase(0); setViews({ 0: 'build', 1: 'build', 2: 'build' }); setNavigationRequest(null); setNotice(''); }}>Reset this universe</button></div></Modal>}
    {completionOpen && <Modal title="From a single atom, a window to the stars." close={() => setCompletionOpen(false)}><div className="completion-icon"><Telescope size={48}/><span>Orbital Observatory complete</span></div><p>You reached the Space Age while protecting your living world.</p><div className="completion-stats"><div><strong>{duration(game.completedAt ?? game.elapsed)}</strong><span>Journey time</span></div><div><strong>{game.health.toFixed(1)}%</strong><span>Biosphere health</span></div><div><strong>{game.stats.supernovae}</strong><span>Supernovae</span></div><div><strong>{fmt(game.stats.taps)}</strong><span>Hydrogen taps</span></div></div><button className="primary-button" onClick={() => setCompletionOpen(false)}>Keep this world growing<ArrowRight size={16}/></button></Modal>}
  </div>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href],input,summary,[tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
    focusables()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const all = focusables();
      if (event.shiftKey && document.activeElement === all[0]) { event.preventDefault(); all.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === all.at(-1)) { event.preventDefault(); all[0]?.focus(); }
    };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" onClick={close} aria-label="Close dialog"><X size={20}/></button><h2 id="modal-title">{title}</h2>{children}</div></div>;
}
