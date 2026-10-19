import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { BALANCE, DEFINITION_MAP, planetStage, protostarSeconds } from '../game';
import type { GameState } from '../game';
import './world-scene.css';

export type WorldSceneProps = {
  phase: 0 | 1 | 2; state: GameState; onGather: () => void; onSelect: (id: string) => void;
  selectedId?: string | null; guideId?: string; tapId?: number;
};
const stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 193 + 67) % 1000, y: (i * 137 + 31) % 760, r: i % 11 === 0 ? 2.1 : i % 3 === 0 ? 1.2 : .7 }));
const colonies = [[270, 330], [190, 480], [390, 485], [115, 375], [355, 215], [470, 350], [115, 570], [465, 575]];
const producers = [[740, 560], [835, 590], [650, 605], [780, 640], [900, 555], [590, 620], [730, 490], [875, 655]];
const places: Record<string, number[][]> = {
  house: [[480,310],[580,336],[405,359],[565,281],[655,362],[455,270]],
  farm: [[235,422],[180,490],[300,479],[275,369]], workshop: [[750,408],[825,460],[665,443],[775,354]],
  school: [[485,485],[570,527],[410,525]], power: [[750,580],[835,546],[650,595]],
  restoration: [[270,594],[350,580],[175,560],[365,638],[150,450],[310,320]],
};

function Ring({ x, y, r, value, color = '#a7eaff', width = 3 }: { x: number; y: number; r: number; value: number; color?: string; width?: number }) {
  return <g fill="none" strokeWidth={width} transform={`rotate(-90 ${x} ${y})`}><circle cx={x} cy={y} r={r} stroke={color} opacity=".16"/><circle cx={x} cy={y} r={r} stroke={color} pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, value))} 100`} strokeLinecap="round"/></g>;
}
function Collector({ x, y, ghost = false, index = 0 }: { x: number; y: number; ghost?: boolean; index?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${index % 2 ? 12 : -12})`} opacity={ghost ? .4 : 1} data-scene-instance="collector"><g className={ghost ? '' : 'scene-satellite-float'} style={{ animationDelay: `${index * -.8}s` }}>
    <ellipse cy="26" rx="29" ry="9" fill="#030d30" opacity=".3"/>
    <path d="M-15-10H-54V12H-15ZM15-10H54V12H15Z" fill="#3659ba" stroke="#a5dbff" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M-43-10V12M-29-10V12M29-10V12M43-10V12M-54 1H-15M15 1H54" stroke="#7fb5ed"/>
    <rect x="-14" y="-17" width="28" height="34" rx="8" fill="#f5e7ce" stroke="#a4b4cf" strokeWidth="2"/>
    <path d="M-10 15L-18 28M10 15L18 28M-8-17L0-28 8-17" fill="none" stroke="#f5e7ce" strokeWidth="3"/>
    <ellipse cy="-27" rx="10" ry="4" fill="#bfeeff"/><circle r="5" fill={ghost ? '#89a2bd' : '#77f5e3'} className={ghost ? '' : 'scene-machine-light'}/>
  </g></g>;
}
function Microbe({ x, y, scale = 1, complex, id, index = 0 }: { x: number; y: number; scale?: number; complex: boolean; id: string; index?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} data-scene-instance="colony"><g className="scene-cell-drift" style={{ animationDelay: `${index * -1.6}s` }}>
    <ellipse cy="10" rx="106" ry="72" fill="#092e65" opacity=".15"/>
    <path d="M-82-38C-37-93 65-77 96-20S60 87-7 69-122 9-82-38Z" fill={`url(#${id}-cell)`} stroke="#befba6" strokeWidth="3"/>
    <path d="M-73-33C-33-76 57-65 82-16S51 71-5 55-105 7-73-33Z" fill="none" stroke="#d9ffba" strokeWidth="1.5" opacity=".6"/>
    {complex ? <g><ellipse cx="-14" cy="-7" rx="35" ry="29" fill="#b988e2" stroke="#f5c8fc" strokeWidth="2"/><circle cx="-18" cy="-9" r="13" fill="#e2b0f1"/><circle cx="-19" cy="-12" r="5" fill="#ffe4f4"/></g> : <path d="M-47-8C-14-45 1 28 34-6S66 28 25 35-14-5-43 19" stroke="#f7d889" strokeWidth="5" strokeLinecap="round" fill="none"/>}
    {[[54,-23,30],[-56,22,-25],[37,35,-18]].map(([cx,cy,r],i) => <g key={i} transform={`translate(${cx} ${cy}) rotate(${r})`}><rect x="-14" y="-7" width="28" height="14" rx="7" fill={complex ? '#ffc594' : '#50bfa0'} stroke={complex ? '#ffe1aa' : '#b4f5af'} strokeWidth="1.5"/><path d="M-9 0Q-5-5-1 0T8 0" fill="none" stroke={complex ? '#ba6d5e' : '#228a86'} strokeWidth="2"/></g>)}
    {[[-36,-42],[17,-44],[69,7],[-26,38],[4,20],[-63,-13]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r="3" fill="#e3ffba" opacity=".8"/>)}
    <path d="M-92 10C-139-5-110 44-151 35" fill="none" stroke="#bcf5ad" strokeWidth="2" strokeLinecap="round"/>
  </g></g>;
}
function Tree({ x, y, scale = 1, warm = false }: { x: number; y: number; scale?: number; warm?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cy="6" rx="25" ry="9" fill="#135951" opacity=".2"/><path d="M-5 1L-3-58H4L7 1Z" fill="#876249"/><path d="M0-28L-15-45M1-39L17-55" stroke="#876249" strokeWidth="4"/><path d="M-35-49C-45-65-30-84-15-79-9-108 23-108 29-84 57-82 55-49 36-44 22-27-13-30-35-49Z" fill={warm ? '#a4ae62' : '#42b78b'} stroke={warm ? '#c8ce85' : '#93e2ac'} strokeWidth="2"/><path d="M-22-62Q-11-86 7-81M13-64Q30-77 38-60" stroke={warm ? '#d0d48c' : '#9ae7b4'} strokeWidth="4" fill="none" strokeLinecap="round" opacity=".6"/></g>;
}
function Fish({ x, y, scale = 1, turtle = false, index = 0 }: { x: number; y: number; scale?: number; turtle?: boolean; index?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><g className="scene-fish-swim" style={{ animationDelay: `${index * -1.7}s` }}>
    {turtle ? <g><ellipse rx="31" ry="22" fill="#5fa68c" stroke="#afe0a1" strokeWidth="2"/><path d="M-15-17L0-8 17-17M-18 14L0 5 16 16M0-8V5M-28-2H-17M18-2H28" stroke="#b1d19a" strokeWidth="2" fill="none"/><ellipse cx="37" cy="-3" rx="13" ry="9" fill="#a5c891"/><path d="M-15-17L-29-32Q-8-34-3-21M12 19L27 32Q4 35 1 22M-18 15L-31 26" fill="#a5c891"/><circle cx="42" cy="-5" r="2" fill="#20494d"/></g> : <g><path d="M-21-3L-49-24V24L-21 4" fill="#f7bc77"/><path d="M-31 0C-9-36 30-30 49 0 30 29-9 35-31 0Z" fill={index % 2 ? '#77cee4' : '#f7cd85'} stroke={index % 2 ? '#b8eff2' : '#ffe8b3'} strokeWidth="2"/><path d="M-4-20L7-35 16-21M-4 20L6 32 14 21" fill="#e89c79"/><path d="M22-16Q13 0 22 16" fill="none" stroke="#bc8e78" strokeWidth="2"/><circle cx="33" cy="-3" r="3" fill="#234663"/><circle cx="34" cy="-4" r="1" fill="#fff4d0"/></g>}
  </g></g>;
}
function Deer({ x, y, scale = 1, primate = false }: { x: number; y: number; scale?: number; primate?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cy="12" rx="35" ry="9" fill="#164c4c" opacity=".2"/>{primate ? <g fill="#bb8b65" stroke="#765749" strokeWidth="2"><path d="M-16-20Q-19 3-6 9H17L21-13Z"/><circle cx="9" cy="-29" r="18"/><ellipse cx="13" cy="-27" rx="12" ry="10" fill="#edc19a"/><circle cx="27" cy="-32" r="6"/><path d="M-15-13L-32 11M16-10L27 12M-12 5L-19 17M11 7L15 17" strokeWidth="7" strokeLinecap="round"/><path d="M-18-4C-66-4-48-49-31-35" strokeWidth="5" fill="none"/><circle cx="10" cy="-29" r="1.7" fill="#3d4146" stroke="none"/><circle cx="18" cy="-29" r="1.7" fill="#3d4146" stroke="none"/></g> : <g><path d="M-27-20Q1-34 27-16L22 2H-25Z" fill="#dfb188"/><path d="M14-17L27-52 42-44 29-9" fill="#dfb188"/><path d="M25-49L21-65M34-48L41-63M21-57L12-63M41-57L49-61" stroke="#bb967a" strokeWidth="3" fill="none"/><path d="M-21-1L-25 24M-9 0L-6 22M17 0L22 24M25-2L35 20" stroke="#b88b6c" strokeWidth="5" strokeLinecap="round"/><path d="M-28-18L-38-27" stroke="#dfb188" strokeWidth="5"/><circle cx="37" cy="-43" r="2" fill="#293f43"/><path d="M-13-20L1-17M-8-11L6-10" stroke="#f9e2b3" strokeWidth="4" strokeLinecap="round"/></g>}</g>;
}
function Structure({ type, x, y, ghost = false, clean = false, electric = false, index = 0 }: { type: string; x: number; y: number; ghost?: boolean; clean?: boolean; electric?: boolean; index?: number }) {
  return <g transform={`translate(${x} ${y})`} opacity={ghost ? .28 : 1} data-scene-instance={type}><g className={ghost ? '' : 'scene-new-object'}>
    <ellipse cy="18" rx="53" ry="20" fill="#285d5c" opacity=".22"/>
    {type === 'house' && <g strokeLinejoin="round"><path d="M-38-15L-4-35 37-15V24L5 42-38 22Z" fill="#ffe6b1"/><path d="M5-3L37-15V24L5 42Z" fill="#dfb685"/><path d="M-48-17L-11-52 46-24 5-2Z" fill="#df8171" stroke="#f3ad86" strokeWidth="2"/><path d="M5-2L46-24 37-15 5 2Z" fill="#ab5f63"/><path d="M-26 4L-14 8V23L-26 19ZM13 6L25 0V14L13 20Z" fill={electric ? '#fff399' : '#7bb7c4'}/><path d="M-6 17L4 21V39L-6 35Z" fill="#8b7469"/></g>}
    {type === 'farm' && <g><path d="M-66-1L-8-34 66-3 8 36Z" fill="#ae9064" stroke="#f1c88c" strokeWidth="2"/>{[0,1,2,3].map(row => <g key={row} transform={`translate(${row * 16 - 29} ${row * 7 - 5})`}><path d="M-21 0L21-23" stroke="#6b744d" strokeWidth="7" strokeLinecap="round"/>{[0,1,2,3].map(i => <g key={i} transform={`translate(${i * 11 - 16} ${-i * 6 + 1})`}><path d="M0 0V-13M0-6L-6-10M0-8L6-13" stroke="#a9db89" strokeWidth="3" strokeLinecap="round"/></g>)}</g>)}<path d="M-60 6V-12M4 35V18M63 0V-17" stroke="#f0d4a3" strokeWidth="3"/></g>}
    {type === 'workshop' && <g><path d="M-44-11L0-31 49-8V33L5 54-44 29Z" fill="#dcaa86"/><path d="M5 10L49-8V33L5 54Z" fill="#b48d7b"/><path d="M-50-14L-19-40 3-18 23-39 56-12 5 10Z" fill="#9e7583" stroke="#ddb6a6" strokeWidth="2"/><path d="M25-25V-83H42V-15Z" fill="#c7a79b"/><path d="M25-83L34-88 49-82 42-77Z" fill="#e9c5af"/><path d="M-28 3L-15 8V24L-28 19ZM-5 14L6 18V34L-5 30Z" fill="#e9ce8e"/><path d="M19 19L37 12V35L19 43Z" fill="#617f88"/>{!ghost && <g className="scene-smoke" opacity={clean ? .12 : .5} style={{ animationDelay: `${index * -.8}s` }} fill="#a4b6b2"><circle cx="36" cy="-102" r="13"/><circle cx="43" cy="-123" r="18"/><circle cx="54" cy="-147" r="22"/></g>}</g>}
    {type === 'school' && <g><path d="M-54-15L-3-36 54-12V26L0 49-54 25Z" fill="#f9dfaa"/><path d="M0 8L54-12V26L0 49Z" fill="#d1b996"/><path d="M-62-18L-6-54 61-17 0 9Z" fill="#568fa5" stroke="#8ac1c3" strokeWidth="2"/><path d="M-11-48V-80H-6V-48" fill="#f5ddb2"/><path d="M-6-80L20-73-6-64Z" fill="#e6907d"/><path d="M-39 1L-25 7V20L-39 14ZM-18 10L-5 15V28L-18 23ZM11 12L24 6V20L11 26ZM32 3L44-2V12L32 17Z" fill="#78b6c8"/><path d="M-9 27L2 32V48L-9 43Z" fill="#956e67"/></g>}
    {type === 'power' && (clean ? <g><path d="M-18 20L-11-75-5-75 0 28" fill="#eff4da"/><circle cx="-9" cy="-75" r="5" fill="#d0e5d3"/><g className="scene-turbine" style={{ transformOrigin: '-9px -75px' }}><path d="M-9-75L-15-124Q-4-132-3-86Z M-9-75L32-51Q34-40 20-46Z M-9-75L-44-46Q-57-50-45-59Z" fill="#f7f4d8" stroke="#c5dfd0" strokeWidth="1.5"/></g><path d="M6 12L40-7 65 7 31 27Z" fill="#508eb2" stroke="#a9dfec" strokeWidth="2"/><path d="M16 5L43 19M27-1L54 13M15 17L48-1" stroke="#95c6dc"/></g> : <g><path d="M-43-18L-5-36 40-15V26L1 47-43 26Z" fill="#c8b998"/><path d="M1 4L40-15V26L1 47Z" fill="#8e9d91"/><path d="M-43-18L-5-36 40-15 1 4Z" fill="#e5cf9c"/><path d="M-28-15L-33-71H-12L-8-7M9-17L10-88H28L30-7" fill="#afafa3" stroke="#e4dcc5" strokeWidth="2"/><path d="M-4 8L-13 23H-2L-7 37 10 17H-1L5 8Z" fill="#ffe39a"/>{!ghost && <g className="scene-smoke" opacity=".35" fill="#c2c8bb"><circle cx="20" cy="-108" r="15"/><circle cx="31" cy="-134" r="20"/></g>}</g>)}
    {type === 'restoration' && <g><path d="M-58 4L-8-26 62 0 9 33Z" fill="#78bc7c" stroke="#bfe1a0" strokeWidth="2"/><Tree x={-23} y={4} scale={.6}/><Tree x={23} y={10} scale={.78}/><path d="M-47 18Q0 0 41 18" fill="none" stroke="#a7dca4" strokeWidth="4"/><path d="M-2 21V5M-2 13Q-20-4-17 11-12 19-2 17M-2 10Q15-9 14 5 9 13-2 13" stroke="#e3f5b8" strokeWidth="2" fill="#9ddba0"/></g>}
  </g></g>;
}

function Hotspot({ object, x, y, name, amount, detail, ids = [object], ghost = false, selectedId, guideId, onSelect }: { selectedId?: string | null; guideId?: string; onSelect: (id: string) => void; object: string; x: number; y: number; name: string; amount?: number; detail?: string; ids?: string[]; ghost?: boolean }) {
    return <button className={`scene-hotspot ${selectedId && ids.includes(selectedId) ? 'is-selected' : ''} ${ids.includes(guideId ?? '') ? 'is-guided' : ''} ${ghost ? 'is-blueprint' : ''}`} style={{ '--scene-x': `${x}%`, '--scene-y': `${y}%` } as CSSProperties} onClick={() => onSelect(object)} aria-label={`Inspect ${DEFINITION_MAP[object]?.name ?? name}`} aria-pressed={!!selectedId && ids.includes(selectedId)} data-scene-object={object} data-owned={amount ?? 0}>
      <span className="scene-object-label"><span>{ghost && <i aria-hidden="true">+</i>}{name}</span>{amount !== undefined && amount > 0 && <b>×{amount}</b>}</span>{detail && <small>{detail}</small>}
    </button>;
  }

export default function WorldScene({ phase, state, onGather, onSelect, selectedId, guideId, tapId = 0 }: WorldSceneProps) {
  const id = `world${useId().replace(/:/g, '')}`;
  const has = (key: string) => (state.upgrades[key] ?? 0) > 0;
  const count = (key: string) => state.buildings[key] ?? 0;
  const stage = planetStage(state), stable = count('stableStar'), red = count('redDwarf');
  const protostar = state.cosmos.protostars[0], healthy = state.health >= 60, terrestrial = has('land');
  const [event, setEvent] = useState<string | null>(null);
  const previous = useRef({ elapsed: state.elapsed, stars: stable + red + state.stars.length, supernovae: state.stats.supernovae });
  useEffect(() => {
    const last = previous.current;
    if (state.elapsed >= last.elapsed && state.elapsed - last.elapsed < 5) {
      if (state.stats.supernovae > last.supernovae) setEvent('Stellar ingredients released');
      else if (stable + red + state.stars.length > last.stars) setEvent('A star ignites');
    }
    previous.current = { elapsed: state.elapsed, stars: stable + red + state.stars.length, supernovae: state.stats.supernovae };
  }, [state.elapsed, stable, red, state.stars.length, state.stats.supernovae]);
  useEffect(() => { if (!event) return; const timer = window.setTimeout(() => setEvent(null), 3200); return () => window.clearTimeout(timer); }, [event]);
  const guided = (ids: string[]) => ids.includes(guideId ?? '');
  const hotspotProps = { selectedId, guideId, onSelect };
  const nurseryIds = ['stellar-nursery','cloud','redDwarf','stableStar','massiveStar','compression','radiativeCooling','stellarSurvey','fusion','stellarAutomation'];
  const planetIds = ['planet-construction','planet','planetCore','planetSurface','planetAtmosphere','planetOceans'];
  const yieldPerTap = BALANCE.tap + (state.upgrades.collection ?? 0);
  const chapterName = ['The stellar nursery', terrestrial ? 'A connected ecosystem' : 'An ocean of life', has('observatory') ? 'A civilization among the stars' : 'A living world, a growing home'][phase];
  return <section className={`world-scene playable-scene playable-scene--${phase} ${!healthy ? 'scene-under-pressure' : ''}`} aria-label={`Interactive world: ${chapterName}`} data-health={state.health} data-profile={state.planet.profile}>
    <div className="scene-heading"><span><i aria-hidden="true"/>{['THE COSMOS','THE LIVING WORLD','CIVILIZATION'][phase]}</span><span className="scene-touch-hint">{phase === 0 ? 'Tap the cloud · select an object' : 'Select your world to grow it'}</span></div>
    <div className="scene-map">
      <svg className="scene-art" viewBox="0 0 1000 760" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-cloud`}><stop stopColor="#e3d3ff" stopOpacity=".95"/><stop offset=".3" stopColor="#a181e8" stopOpacity=".8"/><stop offset=".68" stopColor="#5765b9" stopOpacity=".35"/><stop offset="1" stopColor="#33368d" stopOpacity="0"/></radialGradient>
          <radialGradient id={`${id}-cyan`}><stop stopColor="#b4fff6" stopOpacity=".8"/><stop offset=".5" stopColor="#63c4df" stopOpacity=".3"/><stop offset="1" stopColor="#53bfe2" stopOpacity="0"/></radialGradient>
          <radialGradient id={`${id}-sun`} cx="35%" cy="30%"><stop stopColor="#fff8be"/><stop offset=".4" stopColor="#ffdc7e"/><stop offset=".85" stopColor="#f3a451"/><stop offset="1" stopColor="#e67d58"/></radialGradient>
          <radialGradient id={`${id}-red`} cx="35%" cy="30%"><stop stopColor="#ffdda5"/><stop offset=".5" stopColor="#ed9b79"/><stop offset="1" stopColor="#b85a7c"/></radialGradient>
          <radialGradient id={`${id}-halo`}><stop stopColor="#ffcf77" stopOpacity=".46"/><stop offset=".5" stopColor="#f3a968" stopOpacity=".17"/><stop offset="1" stopColor="#ef9971" stopOpacity="0"/></radialGradient>
          <radialGradient id={`${id}-planet`} cx="30%" cy="25%"><stop stopColor={stage >= 5 ? '#8ee0df' : '#e1af91'}/><stop offset=".5" stopColor={stage >= 5 ? '#4e9ebe' : '#a97983'}/><stop offset="1" stopColor={stage >= 5 ? '#294d82' : '#554771'}/></radialGradient>
          <radialGradient id={`${id}-cell`} cx="30%" cy="25%"><stop stopColor="#b3ed98" stopOpacity=".97"/><stop offset=".6" stopColor="#72c997" stopOpacity=".8"/><stop offset="1" stopColor="#4fb6a9" stopOpacity=".8"/></radialGradient>
          <linearGradient id={`${id}-water`} x2="0" y2="1"><stop stopColor="#347eaa"/><stop offset=".45" stopColor="#236a8e"/><stop offset="1" stopColor="#153f69"/></linearGradient>
          <linearGradient id={`${id}-grass`} x2=".3" y2="1"><stop stopColor={healthy ? '#add89b' : '#b3c28c'}/><stop offset="1" stopColor={healthy ? '#62ae91' : '#839f85'}/></linearGradient>
          <linearGradient id={`${id}-ground`} x2="0" y2="1"><stop stopColor="#a3bc91"/><stop offset=".3" stopColor="#728e83"/><stop offset="1" stopColor="#456c76"/></linearGradient>
          <clipPath id={`${id}-planet-clip`}><circle cx="755" cy="540" r="101"/></clipPath>
          <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
        </defs>
        {phase === 0 && <g>
          <ellipse cx="340" cy="325" rx="340" ry="290" fill={`url(#${id}-cloud)`} opacity=".25" transform="rotate(-25 340 325)"/>
          <ellipse cx="770" cy="130" rx="270" ry="200" fill={`url(#${id}-cloud)`} opacity=".15"/>
          {stars.map((star,i) => <g key={i} fill={i % 7 ? '#d4dff9' : '#f7c7ac'} opacity={.2 + (i % 6) * .12}><circle cx={star.x} cy={star.y} r={star.r}/>{i % 11 === 0 && <path d={`M${star.x - 5} ${star.y}h10M${star.x} ${star.y - 5}v10`} stroke="#d4dff9" strokeWidth=".7"/>}</g>)}
          <g stroke="#a0a8eb" fill="none"><ellipse cx="500" cy="385" rx="436" ry="201" transform="rotate(-20 500 385)" opacity=".11"/><ellipse cx="500" cy="385" rx="375" ry="147" transform="rotate(-20 500 385)" opacity=".1" strokeDasharray="3 10"/></g>
          <g className="scene-nebula-breathe">
            <ellipse cx="290" cy="315" rx="220" ry="158" fill={`url(#${id}-cloud)`} transform="rotate(-25 290 315)"/>
            <ellipse cx="291" cy="330" rx="156" ry="94" fill={`url(#${id}-cyan)`} transform="rotate(20 291 330)"/>
            <g fill="none" strokeLinecap="round"><path d="M139 351C59 272 315 198 433 276S335 428 167 382" stroke="#baa8f2" opacity=".55" strokeWidth="2"/><path d="M158 308C201 230 402 264 420 329S231 410 168 345" stroke="#8ad8e6" opacity=".5" strokeWidth="1.5"/><path d="M182 340C130 289 288 254 367 295S316 380 211 354" stroke="#e4cdff" opacity=".7" strokeWidth="2"/></g>
            {Array.from({ length: 23 }, (_,i) => <circle key={i} cx={290 + Math.cos(i * 2.4) * (62 + i * 5)} cy={320 + Math.sin(i * 2.4) * (35 + i * 3.3)} r={i % 3 === 0 ? 3 : 1.8} fill={i % 2 ? '#bbfff1' : '#e2c3ff'} opacity={.25 + (i % 4) * .15}/>)}
            <circle cx="290" cy="320" r="37" fill={`url(#${id}-cyan)`}/><circle cx="290" cy="320" r="10" fill="#d7f0ff" opacity=".8"/>
          </g>
          <Ring x={290} y={320} r={143} value={state.cosmos.density} color="#bfa9fa" width={2}/><Ring x={290} y={320} r={151} value={state.cosmos.cooling} color="#82e0eb" width={2}/>
          {Array.from({ length: Math.max(1, Math.min(count('collector'),8)) }, (_,i) => { const a = -2.18 + i * .83; return <Collector key={i} x={290 + Math.cos(a) * 188} y={320 + Math.sin(a) * 170} ghost={!count('collector')} index={i}/>; })}
          {count('collector') > 0 && <g fill="#a4f3ed" className="scene-hydrogen-stream" opacity=".7"><circle cx="178" cy="270" r="3"/><circle cx="199" cy="280" r="2"/><circle cx="220" cy="293" r="3"/><circle cx="240" cy="301" r="1.6"/></g>}
          {stable + red > 0 ? <g data-scene-instance="stableStar" className="scene-new-object"><circle cx="650" cy="235" r="167" fill={`url(#${id}-halo)`}/><circle cx="650" cy="235" r={stable ? 64 : 47} fill={`url(#${id}-${stable ? 'sun' : 'red'})`}/><circle cx="650" cy="235" r={stable ? 71 : 55} fill="none" stroke="#ffd79a" strokeWidth="2" opacity=".3"/><g fill="none" stroke="#fff0b5" opacity=".35" strokeWidth="2"><path d="M609 213Q647 188 690 218M601 242Q640 220 701 246M618 264Q649 246 684 266"/></g>{stable > 0 && red > 0 && <g><circle cx="823" cy="331" r="72" fill={`url(#${id}-halo)`}/><circle cx="823" cy="331" r="25" fill={`url(#${id}-red)`}/></g>}{Array.from({ length: Math.min(2,Math.max(0,stable + red - 1)) }, (_,i) => <circle key={i} cx={708 + i * 42} cy={124 - i * 8} r={11 + i * 3} fill={`url(#${id}-sun)`} opacity=".8"/>)}</g> : <g opacity=".24"><circle cx="650" cy="235" r="67" fill="none" stroke="#e5bd96" strokeWidth="1.5" strokeDasharray="4 9"/><path d="M635 235H665M650 220V250" stroke="#e5bd96" strokeWidth="2"/></g>}
          {(protostar || count('cloud') > 0) && <g data-scene-instance="protostar"><ellipse cx="561" cy="398" rx="82" ry="30" transform="rotate(-23 561 398)" fill={`url(#${id}-cloud)`}/><ellipse cx="561" cy="398" rx="69" ry="20" transform="rotate(-23 561 398)" fill="none" stroke="#dbbef3" strokeWidth="2" opacity=".65"/><circle cx="561" cy="398" r={protostar ? 14 + (1 - protostar.remaining / protostar.total) * 14 : 8} fill={`url(#${id}-sun)`}/>{protostar && <Ring x={561} y={398} r={53} value={(1 - protostar.remaining / protostar.total) * 100} color="#ffd1a1"/>}</g>}
          {state.stars.length > 0 && <g data-scene-instance="massiveStar" className="scene-new-object"><circle cx="851" cy="151" r="107" fill={`url(#${id}-halo)`}/><circle cx="851" cy="151" r="36" fill={`url(#${id}-red)`}/><Ring x={851} y={151} r={47} value={state.stars[0].remaining / BALANCE.massiveLifetime * 100} color="#ffad9c"/>{state.stars.length > 1 && <circle cx="918" cy="211" r="15" fill={`url(#${id}-red)`}/>}</g>}
          {event && <g transform={event === 'Stellar ingredients released' ? 'translate(851 151)' : 'translate(650 235)'} key={`${event}${state.stats.supernovae}`} data-scene-effect={event === 'Stellar ingredients released' ? 'supernova' : 'ignition'}>
            <g className="scene-stellar-flash"><circle r="120" fill={`url(#${id}-halo)`}/><circle r="27" fill="#fff2c9" opacity=".8"/></g>
            <g className="scene-stellar-shockwave" fill="none" stroke={event === 'Stellar ingredients released' ? '#ffc2c8' : '#ffe4a3'}><circle r="47" strokeWidth="3"/><circle r="64" strokeWidth="1.5" opacity=".5"/></g>
            {Array.from({ length: 9 }, (_,i) => <g key={i} transform={`rotate(${i * 40})`}><path className="scene-stellar-ray" d="M0-58V-82" stroke={i % 3 === 0 ? '#d5b9ff' : i % 3 === 1 ? '#b0eee9' : '#ffe2a8'} strokeWidth="3" strokeLinecap="round" style={{ animationDelay: `${i % 3 * .06}s` }}/></g>)}
          </g>}
          {count('planet') > 0 ? <g data-scene-instance="planet" className="scene-new-object">
            {stage >= 4 && <><circle cx="755" cy="540" r="112" fill={`url(#${id}-cyan)`} opacity=".65"/><circle cx="755" cy="540" r="107" fill="none" stroke="#b4f5e6" strokeWidth="2" opacity=".6"/></>}{stage < 3 && <ellipse cx="755" cy="540" rx="164" ry="42" fill="none" stroke="#d2b3b3" strokeWidth="2" transform="rotate(-20 755 540)" opacity=".45"/>}<circle cx="755" cy="540" r={stage === 1 ? 60 : stage === 2 ? 82 : 101} fill={`url(#${id}-planet)`}/>
            {stage >= 3 && <g clipPath={`url(#${id}-planet-clip)`} fill={stage >= 5 ? state.planet.profile === 'mineral' ? '#c8bf92' : '#a8ca9c' : '#c3a6a0'}><path transform={state.planet.profile === 'oceanic' ? 'translate(755 540) scale(.78) translate(-755 -540)' : undefined} d="M655 500L688 470 718 474 734 500 722 528 686 536 667 522ZM758 449L801 453 834 483 815 510 788 506 771 485ZM738 553L769 546 796 567 784 600 754 631 739 601Z"/>{stage >= 4 && <g fill="none" stroke="#eff9e2" strokeWidth="5" opacity=".6" strokeLinecap="round"><path d="M671 548Q699 530 725 544M771 481Q800 470 824 490M750 602Q779 586 807 597"/></g>}</g>}{stage === 2 && <g stroke="#ffc39c" fill="none" opacity=".6"><path d="M689 512Q756 484 827 535M699 573Q760 545 828 573" strokeWidth="3"/><circle cx="755" cy="540" r="39" strokeWidth="2"/></g>}<circle cx="888" cy="571" r="14" fill="#b5b5c8"/><circle cx="884" cy="567" r="4" fill="#8e92aa"/>
          </g> : <g opacity=".3"><ellipse cx="755" cy="540" rx="145" ry="49" fill="none" stroke="#c6b4dc" strokeDasharray="3 8" transform="rotate(-17 755 540)"/>{Array.from({ length: 20 }, (_,i) => <circle key={i} cx={755 + Math.cos(i * 1.9) * (55 + i * 4)} cy={540 + Math.sin(i * 1.9) * (22 + i * 1.3)} r={i % 4 === 0 ? 5 : 2} fill="#c2b4db"/>)}<circle cx="755" cy="540" r="31" fill="#8b77ac" opacity=".35"/></g>}
        </g>}
        {phase === 1 && <g>
          <g fill="#b2f2d1" opacity=".08"><path d="M80 0H160L430 760H300Z"/><path d="M350 0H410L630 760H565Z"/><path d="M695 0H760L800 760H730Z"/></g><g fill="none" stroke="#a3e9dc" opacity=".16"><path d="M-50 119Q140 75 300 119T650 119T1050 119M-50 143Q140 99 300 143T650 143T1050 143"/><path d="M-20 666Q160 627 360 666T720 666T1040 666"/></g>
          <path d="M-20 644C120 584 204 661 350 639S580 575 740 599 915 631 1020 581V760H-20Z" fill="#537d83"/><path d="M-20 678C120 618 204 695 350 673S580 609 740 633 915 665 1020 615V760H-20Z" fill="#355b74"/><g fill="#a2c9bb" opacity=".35">{Array.from({ length: 28 }, (_,i) => <ellipse key={i} cx={(i * 137 + 31) % 1000} cy={675 + (i * 19) % 74} rx={i % 3 + 2} ry="2"/>)}</g>
          {has('photosynthesis') && Array.from({ length: Math.max(1,Math.min(count('producer'),8)) }, (_,i) => <g key={i} transform={`translate(${producers[i][0]} ${producers[i][1]})`} data-scene-instance="producer" opacity={count('producer') ? 1 : .28}><g className="scene-kelp-sway" style={{ animationDelay: `${i * -.9}s` }} fill="none" strokeLinecap="round"><path d="M0 27Q-25-17 0-67T-1-129M-13 17Q-40-19-33-68M8 13Q36-38 27-92" stroke={healthy ? '#78d0a4' : '#9fac82'} strokeWidth="9"/><path d="M-1-102Q-43-113-35-87-19-70 0-85M-6-60Q37-91 37-65 19-46-6-44M-32-45Q-56-73-61-48-52-31-32-32M27-72Q50-100 57-80 50-64 27-58" fill={healthy ? '#a8df93' : '#b5bc87'} stroke="none"/></g><ellipse cy="25" rx="33" ry="10" fill="#8fc2a1"/></g>)}
          {Array.from({ length: Math.min(count('colony'),8) }, (_,i) => <Microbe key={i} x={colonies[i][0]} y={colonies[i][1]} scale={i === 0 ? terrestrial ? .65 : 1.13 : .28 + (i % 3) * .1} complex={has('eukaryotes')} id={id} index={i}/>)}
          {has('multicellular') && <g transform="translate(520 220)" data-scene-instance="multicellular">{[[0,0],[29,0],[15,25],[-14,25],[0,50],[29,50]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="18" fill="#b1b3e5" stroke="#e0d1f6" strokeWidth="2"/>)}<path d="M1 69Q-19 103 8 116" fill="none" stroke="#c6beee" strokeWidth="2"/></g>}
          {has('animals') && <><Fish x={725} y={360} scale={.9}/><Fish x={824} y={400} scale={.55} index={1}/><Fish x={620} y={462} scale={.62} index={2}/></>}{has('vertebrates') && <Fish x={590} y={340} scale={1.05} turtle index={3}/>}
          {terrestrial && <g data-scene-instance="land"><path d="M365 277Q397 227 494 241L592 196 725 225 870 308 937 364 898 401 709 429 537 391 378 357 347 317Z" fill="#528c89"/><path d="M365 263Q397 213 494 227L592 182 725 211 870 294 937 350 898 372 709 400 537 362 378 328 347 303Z" fill={`url(#${id}-grass)`}/><path d="M396 319Q558 294 697 358T901 345" fill="none" stroke="#bce6cf" strokeWidth="10" opacity=".7"/><Tree x={463} y={278} scale={.9} warm={!healthy}/><Tree x={545} y={298} scale={1.13} warm={!healthy}/><Tree x={798} y={334} scale={.85} warm={!healthy}/><Tree x={857} y={344} scale={.7} warm={!healthy}/>{has('mammals') && <Deer x={670} y={302} scale={.8}/>}{has('primates') && <Deer x={751} y={329} scale={.7} primate/>}{has('humans') && <g transform="translate(608 306)"><circle cy="-23" r="7" fill="#eed2aa"/><path d="M0-13V6M-1 6L-9 22M1 6L9 22M0-8L-13 0M1-7L12 0" stroke="#efbe9a" strokeWidth="6" strokeLinecap="round"/><path d="M-8-13H7L10 5H-8Z" fill="#d98577"/></g>}</g>}
          <g fill="#b2e8e0" opacity=".45">{Array.from({ length: 20 }, (_,i) => <circle key={i} className="scene-plankton" cx={(i * 137 + 87) % 1000} cy={(i * 71 + 140) % 590} r={i % 3 + 1} style={{ animationDelay: `${i * -.6}s` }}/>)}</g>{!healthy && <rect width="1000" height="760" fill="#b5ac74" opacity=".1"/>}
        </g>}
        {phase === 2 && <g>
          <g fill="none" stroke="#b7e9df" strokeLinecap="round" opacity=".2"><path d="M48 540Q107 523 150 540M27 570Q87 553 130 570M805 671Q866 651 934 671M751 704Q828 681 894 704M820 299Q878 282 931 299M69 340Q123 322 169 340" strokeWidth="3"/></g><g opacity=".65" fill="#e0f3df"><path d="M53 161Q74 140 91 150 108 119 134 137 152 125 168 147 201 144 211 162Z"/><path d="M752 112Q779 83 806 101 828 66 854 91 879 79 903 111Z"/></g><circle cx="147" cy="123" r="49" fill="#f5db9b" opacity=".8"/>
          <ellipse cx="506" cy="539" rx="440" ry="171" fill="#124663" opacity=".2"/><path d="M80 426Q126 340 313 324L430 268 671 286 825 358Q954 409 915 520L853 596 652 682 443 662 226 592 106 501Z" fill={`url(#${id}-ground)`}/><path d="M80 400Q126 314 313 298L430 242 671 260 825 332Q954 383 915 494L853 555 652 631 443 613 226 550 106 475Z" fill="#d8d5a0"/><path d="M105 390Q151 324 317 316L434 261 666 278 817 347Q928 389 894 478L839 535 649 607 448 591 240 530 124 462Z" fill={`url(#${id}-grass)`}/>
          <path d="M312 309Q350 382 477 422T805 469M472 300Q421 403 490 533L520 593M189 457L720 550M694 328Q630 406 663 520" stroke="#dfe1b3" strokeWidth="13" strokeLinecap="round" fill="none" opacity=".85"/><path d="M111 425Q146 388 180 387M840 515L870 491M667 607L715 589M362 583L397 594" stroke="#e8e2b4" strokeWidth="5" strokeLinecap="round" fill="none"/>
          {[[326,300,.85],[369,291,.65],[709,300,.8],[751,316,.8],[860,397,.7],[151,396,.7],[613,591,.65],[419,580,.7]].map(([x,y,scale],i) => <Tree key={i} x={x} y={y} scale={healthy ? scale : scale * .7} warm={!healthy}/>)}
          {(['farm','house','workshop','school','power','restoration'] as const).map(type => Array.from({ length: Math.max(1,Math.min(count(type),places[type].length)) }, (_,i) => <Structure key={`${type}${i}`} type={type} x={places[type][i][0]} y={places[type][i][1]} ghost={!count(type)} clean={has('cleanEnergy')} electric={has('electricity')} index={i}/>))}
          {count('house') > 0 && <g className="scene-settlers" stroke="#f1c89f" strokeWidth="3.5" strokeLinecap="round">{[[412,420],[590,445],[548,378]].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`}><circle cy="-9" r="4" fill="#f4d2ae" stroke="none"/><path d="M0-3V7M0 7L-4 14M0 7L4 14"/><path d="M-3-3H3L5 5H-4Z" fill={i % 2 ? '#7d9fc3' : '#d8957d'} stroke="none"/></g>)}</g>}
          {has('electricity') && <g stroke="#8b9d87" strokeWidth="2" fill="none"><path d="M575 397V445M716 493V536M575 398Q642 444 716 493"/><path d="M563 403H587M704 499H728" strokeWidth="3"/><circle cx="575" cy="403" r="4" fill="#fff3ad" stroke="none"/><circle cx="716" cy="499" r="4" fill="#fff3ad" stroke="none"/></g>}
          {has('spaceflight') && !has('observatory') && <g transform="translate(807 159) rotate(-18)" data-scene-instance="spaceflight"><ellipse rx="99" ry="36" fill="none" stroke="#c4eee1" strokeDasharray="2 7" opacity=".4"/><path d="M-12-8H-46V10H-12ZM12-8H46V10H12Z" fill="#5a91b6" stroke="#a5dce1" strokeWidth="2"/><path d="M-35-8V10M-25-8V10M25-8V10M35-8V10M-46 1H-12M12 1H46" fill="none" stroke="#a5dce1"/><rect x="-10" y="-17" width="20" height="37" rx="6" fill="#f0e8c9"/><circle cy="-8" r="5" fill="#9dd7da"/></g>}
          {has('observatory') && <g transform="translate(811 151)" data-scene-instance="observatory"><circle r="88" fill={`url(#${id}-cyan)`} opacity=".5"/><path d="M-15-13H-64V14H-15ZM15-13H64V14H15Z" fill="#7b9fce" stroke="#d6ebef" strokeWidth="2"/><path d="M-47-13V14M-31-13V14M31-13V14M47-13V14M-64 0H-15M15 0H64" fill="none" stroke="#b1d5e8"/><rect x="-12" y="-47" width="24" height="77" rx="8" fill="#fbebcb"/><ellipse cy="-47" rx="12" ry="8" fill="#354c79" stroke="#e9debf" strokeWidth="3"/><path d="M-12 27L-25 46M12 27L25 46" stroke="#e9debf" strokeWidth="4"/></g>}
          {!healthy && <path data-scene-effect="industrial-haze" d="M460 100Q692 59 976 212V489Q703 284 480 373Z" fill="#bfc3a2" opacity={Math.min(.35,(65 - state.health) / 160)} filter={`url(#${id}-soft)`}/>}
        </g>}
      </svg>
      {phase === 0 && <>
        <button className={`scene-gather ${guided(['gather-hydrogen','gather','hydrogen']) && !count('collector') ? 'is-guided' : ''}`} onClick={onGather} aria-label="Gather hydrogen from cloud" data-scene-object="hydrogen" style={{ '--scene-x':'29%', '--scene-y':'42%' } as CSSProperties}><span className="scene-gather-symbol" aria-hidden="true">H<sup>+</sup></span><span>Gather hydrogen</span><small>+{yieldPerTap} per tap</small>{tapId > 0 && <span className="scene-tap-particles" key={tapId} aria-hidden="true"><i/><i/><i/><i/><b>+{yieldPerTap} H</b></span>}</button>
        <Hotspot {...hotspotProps} object="collector" x={16} y={22} name={count('collector') ? 'Collectors' : 'Build collector'} amount={count('collector')} detail={count('collector') ? 'Hydrogen, automatically' : `${DEFINITION_MAP.collector.cost.hydrogen} H · start automation`} ids={['collector','collection']} ghost={!count('collector')}/>
        <Hotspot {...hotspotProps} object="stellar-nursery" x={56} y={59} name={protostar ? 'Protostar' : 'Stellar nursery'} detail={protostar ? state.resources.hydrogen < BALANCE.protostarHydrogen ? 'Needs hydrogen to grow' : `${Math.ceil(protostarSeconds(state, protostar))}s to ignition` : count('cloud') ? `${count('cloud')} cloud${count('cloud') === 1 ? '' : 's'} ready` : 'Prepare a gas cloud'} ids={nurseryIds}/>
        {protostar && <span className="scene-process-accessible" role="progressbar" aria-label="Protostar formation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1 - protostar.remaining / protostar.total) * 100)} data-process="protostar" data-remaining={protostar.remaining}/>}
        {(stable + red > 0 || guided(['stableStar','redDwarf'])) && <Hotspot {...hotspotProps} object={stable ? 'stableStar' : 'redDwarf'} x={65} y={19} name={stable ? 'Stable stars' : 'Small stable stars'} amount={stable + red} detail="Hydrogen → helium" ids={['stableStar','redDwarf','fusion']}/>}
        {state.stars.length > 0 && <Hotspot {...hotspotProps} object="massiveStar" x={86} y={10} name="Massive stars" amount={state.stars.length} detail={`${Math.ceil(state.stars[0].remaining)}s to supernova`}/>}
        <Hotspot {...hotspotProps} object="planet-construction" x={75} y={84} name={stage >= 5 ? 'Ocean world' : stage ? 'Rocky world' : 'A future world'} amount={count('planet')} detail={stage ? `Assembly ${stage}/5${stage >= 5 ? ' · chemistry active' : ''}` : 'Gather stellar ingredients'} ids={planetIds} ghost={!stage}/>
        {stage >= 5 && <Hotspot {...hotspotProps} object="planet-environment" x={89} y={61} name="Habitats" detail={`${Math.round(state.habitability)}% habitable`} ids={['planet-environment','pond','climateRegulation','nutrientCycling','tidalPools','mineralSurfaces','oceanVents','abiogenesis']}/>}
        <div className="scene-cloud-readiness" aria-label={`Cloud density ${Math.floor(state.cosmos.density)} percent; cooling ${Math.floor(state.cosmos.cooling)} percent`}><span><i className="density-dot"/>Density <b>{Math.floor(state.cosmos.density)}%</b></span><span><i className="cooling-dot"/>Cooling <b>{Math.floor(state.cosmos.cooling)}%</b></span></div>
      </>}
      {phase === 1 && <>
        <Hotspot {...hotspotProps} object="colony" x={27} y={terrestrial ? 52 : 58} name="Microbial colonies" amount={count('colony')} detail="The foundation of life" ids={['colony','reproduction','metabolism','population','eukaryotes']}/>
        <Hotspot {...hotspotProps} object={has('photosynthesis') ? 'producer' : 'photosynthesis'} x={77} y={85} name={has('photosynthesis') ? 'Producer habitats' : 'Capture starlight'} amount={count('producer')} detail={has('photosynthesis') ? 'Biomass · food webs' : 'Discover photosynthesis'} ids={['producer','photosynthesis']} ghost={!has('photosynthesis')}/>
        {terrestrial && <Hotspot {...hotspotProps} object={has('humans') ? 'humans' : has('primates') ? 'humans' : has('mammals') ? 'primates' : 'mammals'} x={65} y={24} name="Life on land" detail={has('primates') ? 'Social, adaptable lineages' : 'A growing web of life'} ids={['land','mammals','primates','humans']}/>}
        {!terrestrial && has('animals') && <Hotspot {...hotspotProps} object={has('vertebrates') ? 'land' : 'vertebrates'} x={76} y={36} name="Aquatic life" detail="Consumers need producers" ids={['animals','vertebrates','land']}/>}
      </>}
      {phase === 2 && <>
        <Hotspot {...hotspotProps} object="farm" x={21} y={44} name="Farms" amount={count('farm')} ghost={!count('farm')} ids={['farm','agriculture']}/>
        <Hotspot {...hotspotProps} object="house" x={51} y={28} name="Homes" amount={count('house')} detail={`${Math.floor(state.population)} people`} ghost={!count('house')}/>
        <Hotspot {...hotspotProps} object="workshop" x={80} y={36} name="Workshops" amount={count('workshop')} ghost={!count('workshop')} ids={['workshop','industry']}/>
        <Hotspot {...hotspotProps} object="school" x={49} y={73} name="Schools" amount={count('school')} ghost={!count('school')} ids={['school','writing','computing']}/>
        <Hotspot {...hotspotProps} object="power" x={81} y={86} name={has('cleanEnergy') ? 'Clean energy' : 'Power stations'} amount={count('power')} ghost={!count('power')} ids={['power','electricity','cleanEnergy']}/>
        <Hotspot {...hotspotProps} object="restoration" x={25} y={88} name="Restoration" amount={count('restoration')} ghost={!count('restoration')} ids={['restoration','conservation']}/>
        {has('spaceflight') && <Hotspot {...hotspotProps} object="observatory" x={82} y={10} name={has('observatory') ? 'Orbital Observatory' : 'Build the Observatory'} detail={has('observatory') ? 'A new perspective' : 'Our next horizon'} ids={['spaceflight','observatory']}/>}
      </>}
    </div>
    {phase > 0 && <button className={`scene-health ${guided(['biosphere-care','restore']) ? 'is-guided' : ''}`} onClick={() => onSelect('biosphere-care')} aria-label={`Biosphere health ${Math.round(state.health)} percent. Select to care for your world.`} data-scene-object="biosphere-care"><span aria-hidden="true">❧</span><span>Biosphere <b>{Math.round(state.health)}%</b><i><em style={{ width: `${Math.max(0,Math.min(100,state.health))}%` }}/></i></span></button>}
    {event && phase === 0 && <div className="scene-world-event" role="status" key={`${event}${state.stats.supernovae}`}><span aria-hidden="true">✦</span>{event}</div>}
    <div className="scene-footer"><span>{chapterName}</span><small>{phase === 0 ? 'A little hydrogen. Endless possibility.' : phase === 1 ? 'Earlier life keeps your ecosystem alive.' : 'Every community depends on its biosphere.'}</small></div>
  </section>;
}
