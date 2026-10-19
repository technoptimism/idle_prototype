import { useEffect, useId, useRef, useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { BIO_IDS, DEFINITION_MAP, requirements } from '../game';
import type { GameState } from '../game';
import './evolution-map.css';

interface EvolutionMapProps {
  game: GameState;
  selectedId?: string | null;
  guideId?: string;
  onSelect: (id: string) => void;
}

const POINTS: Record<string, { x: number; y: number; label: string; tint: string }> = {
  abiogenesis: { x: 160, y: 43, label: 'First cells', tint: '#89d6b4' },
  photosynthesis: { x: 62, y: 143, label: 'Photosynthesis', tint: '#acdf72' },
  eukaryotes: { x: 236, y: 143, label: 'Endosymbiosis', tint: '#9dc9e8' },
  multicellular: { x: 236, y: 237, label: 'Multicellular life', tint: '#c0ace8' },
  animals: { x: 144, y: 331, label: 'Animal lineages', tint: '#edb5d3' },
  vertebrates: { x: 236, y: 425, label: 'Vertebrates', tint: '#82d9e0' },
  land: { x: 144, y: 519, label: 'Life on land', tint: '#aad180' },
  mammals: { x: 236, y: 613, label: 'Mammals', tint: '#edc494' },
  primates: { x: 144, y: 707, label: 'Primates', tint: '#d9b291' },
  humans: { x: 236, y: 801, label: 'Human communities', tint: '#f0cb80' },
};

const WIDE_POINTS = Object.fromEntries(Object.entries(POINTS).map(([id, point]) => [id, { ...point, ...({
  abiogenesis: { x: 80, y: 50 }, photosynthesis: { x: 80, y: 230 },
  eukaryotes: { x: 260, y: 50 }, multicellular: { x: 440, y: 50 },
  animals: { x: 620, y: 50 }, vertebrates: { x: 620, y: 230 },
  land: { x: 440, y: 230 }, mammals: { x: 260, y: 230 },
  primates: { x: 260, y: 410 }, humans: { x: 440, y: 410 },
} as Record<string, { x: number; y: number }>)[id] }])) as typeof POINTS;

/** Local illustrations keep the web readable without an external sprite sheet. */
function EvolutionGlyph({ id }: { id: string }) {
  let drawing;
  switch (id) {
    case 'abiogenesis':
      drawing = <><path d="M11 32C5 25 11 11 22 11s18 8 15 17-19 15-26 4Z" fill="#d7f3c1"/><path d="m13 33-5 6m5-1-3 5m23-27 5-5"/><path d="M17 22c2-6 12-6 13 0s-9 9-12 4" stroke="#45866d"/><circle cx="16" cy="17" r="1.3" fill="#45866d" stroke="none"/><circle cx="31" cy="29" r="1.3" fill="#45866d" stroke="none"/></>;
      break;
    case 'photosynthesis':
      drawing = <><path d="M9 33C7 16 22 10 37 10c1 15-4 30-19 28Z" fill="#e4ef9d"/><path d="m13 35 17-17m-9 9-1-9m1 9 10 1" stroke="#568543"/><path d="m8 7 2 3m23 29 2 3m5-18 4 1"/><circle cx="8" cy="16" r="2" fill="#f7eab0" stroke="none"/></>;
      break;
    case 'eukaryotes':
      drawing = <><path d="M39 24c0 11-8 16-17 15S7 33 8 23 14 7 25 8s15 7 14 16Z" fill="#e1f0ed"/><circle cx="23" cy="23" r="7" fill="#83a8cc"/><circle cx="24" cy="22" r="2" fill="#dceaf5" stroke="none"/><path d="M11 25c5-2 9 6 3 7m16-21c-4 4 3 10 6 6" stroke="#b38b54"/></>;
      break;
    case 'multicellular':
      drawing = <>{[[17, 15], [29, 14], [35, 26], [24, 33], [12, 28], [23, 24]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="8" fill={i % 2 ? '#e6d4ed' : '#d1e4ea'}/><circle cx={x} cy={y} r="2" fill="#8c82ae" stroke="none"/></g>)}</>;
      break;
    case 'animals':
      drawing = <><path d="M10 24c0-10 6-16 14-16s14 6 14 16c-5 4-23 4-28 0Z" fill="#f7d1dc"/><path d="M17 29c-5 4 5 8-1 12m8-12c-3 5 4 7 0 13m8-13c6 4-4 7 1 11"/><path d="M18 20h1m10 0h1" strokeWidth="3"/><path d="M21 24q3 3 6 0"/></>;
      break;
    case 'vertebrates':
      drawing = <><path d="M10 24c9-13 19-13 26-5l6-5v20l-6-5c-9 8-20 6-26-5Z" fill="#c1eff0"/><path d="m22 17 5-8 4 10m-9 10 6 8 3-8" fill="#77c9cc"/><circle cx="17" cy="22" r="2" fill="#315b65" stroke="none"/><path d="M24 19v10"/></>;
      break;
    case 'land':
      drawing = <><path d="M9 29c-4 1-4 5 2 6 6 0 9-7 15-9l8-1c8-2 9-10 2-12-8-2-12 9-16 10Z" fill="#d4e9a6"/><path d="m23 22-6-7-4 1m10 13-2 8-4 1m12-16 3-8m0 12 7 5-1 4"/><circle cx="36" cy="18" r="1.6" fill="#315b65" stroke="none"/></>;
      break;
    case 'mammals':
      drawing = <><path d="M11 29c-6 0-6 8 0 9"/><path d="M11 31c-3-11 4-18 14-18 9 0 12 7 15 13-4 8-18 13-29 5Z" fill="#f2dab9"/><circle cx="28" cy="14" r="6" fill="#f4deca"/><circle cx="28" cy="14" r="3" fill="#e9b8ad" stroke="none"/><circle cx="34" cy="23" r="1.5" fill="#315b65" stroke="none"/><path d="m39 26 3 1m-23 7-1 4m10-5 2 4"/></>;
      break;
    case 'primates':
      drawing = <><circle cx="9" cy="24" r="5" fill="#cda07b"/><circle cx="39" cy="24" r="5" fill="#cda07b"/><path d="M10 22C9 6 39 6 38 22v8c-1 13-27 13-28 0Z" fill="#aa8167"/><path d="M15 17c4-4 8 0 9 2 2-3 6-5 10-1l-1 12c-1 8-17 8-18 0Z" fill="#f1d4ac"/><path d="M18 23h1m10 0h1" strokeWidth="3"/><path d="M20 31q4 3 8 0"/></>;
      break;
    default:
      drawing = <><circle cx="19" cy="15" r="7" fill="#f5d4ac"/><path d="M7 38v-5c0-13 24-13 24 0v5Z" fill="#e3b878"/><circle cx="34" cy="22" r="5" fill="#e6ba91"/><path d="M31 31c6-5 12 1 11 7H32" fill="#b2d4b7"/><path d="M13 11q6-8 12 0" stroke="#86654e" strokeWidth="3"/></>;
  }
  return <svg className="evolution-glyph" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{drawing}</svg>;
}

function ancestryPath(parent: string, child: string, points: typeof POINTS, compact: boolean): string {
  const a = points[parent];
  const b = points[child];
  if (!compact && a.y === b.y) {
    const direction = Math.sign(b.x - a.x);
    return `M${a.x + direction * 24},${a.y} H${b.x - direction * 24}`;
  }
  if (a.x === b.x) {
    const side = compact || a.x > 500 ? 1 : -1;
    const bend = compact ? 315 : a.x + side * 70;
    return `M${a.x + side * 22},${a.y} C${bend},${a.y + 12} ${bend},${b.y - 12} ${b.x + side * 22},${b.y}`;
  }
  return `M${a.x},${a.y + 22} C${a.x},${a.y + 50} ${b.x},${b.y - 50} ${b.x},${b.y - 22}`;
}

export default function EvolutionMap({ game, selectedId, guideId, onSelect }: EvolutionMapProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const points = compact ? POINTS : WIDE_POINTS;
  const width = compact ? 320 : 700;
  const height = compact ? 876 : 485;
  const instanceId = useId();
  const living = BIO_IDS.filter(id => (game.upgrades[id] ?? 0) > 0).length;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setCompact(entries[0].contentRect.width < 580));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const target = points[selectedId ?? guideId ?? ''];
    const element = viewport.current;
    if (!target || !element) return;
    const scale = Math.min(element.clientWidth, compact ? Infinity : 800) / width;
    const top = (target.y - 30) * scale;
    const bottom = (target.y + 70) * scale;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  }, [selectedId, guideId, compact, points, width]);

  return <section className={`evolution-map ${compact ? 'evolution-map--compact' : 'evolution-map--wide'}`} aria-label="Evolution web">
    <header className="evolution-map__header"><span><Sparkles size={14} aria-hidden="true"/>Evolution web</span><small>{living} / {BIO_IDS.length} living</small></header>
    <div className="evolution-map__legend" aria-label="Connection key"><span><i className="ancestry-key"/>Ancestry</span><span><i className="support-key"/>Ecological support</span></div>
    <div className="evolution-map__viewport" ref={viewport} tabIndex={0} aria-label="Scrollable evolution map. Select any lineage to inspect it.">
      <div className="evolution-map__canvas" style={{ aspectRatio: `${width}/${height}` }}>
        <svg className="evolution-map__connections" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs><radialGradient id={`${instanceId}-glow`}><stop stopColor="#b5d7b9" stopOpacity=".45"/><stop offset="1" stopColor="#b5d7b9" stopOpacity="0"/></radialGradient></defs>
          <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${instanceId}-glow)`}/>
          <g className="evolution-map__spores">{[[27, 50, 3], [290, 62, 2], [106, 245, 4], [58, 356, 2], [298, 381, 3], [54, 590, 4], [285, 701, 2], [57, 810, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r}/>)}</g>
          {BIO_IDS.filter(id => DEFINITION_MAP[id].lineageParent).map(id => {
            const parent = DEFINITION_MAP[id].lineageParent!;
            return <path key={id} data-edge-kind="ancestry" data-edge-from={parent} data-edge-to={id} d={ancestryPath(parent, id, points, compact)} className={`evolution-map__ancestry ${(game.upgrades[id] ?? 0) > 0 ? 'is-living' : ''}`}/>;
          })}
          {BIO_IDS.flatMap(id => (DEFINITION_MAP[id].ecologicalRequires ?? []).map(parent => {
            const a = points[parent];
            const b = points[id];
            const path = compact ? `M${a.x - 22},${a.y} C12,${a.y + 40} 20,${b.y - 42} ${b.x - 22},${b.y}`
              : id === 'animals' ? `M${a.x + 22},${a.y} C${a.x + 45},155 ${b.x},175 ${b.x},${b.y + 24}`
              : `M${a.x + 22},${a.y} C${a.x + 90},355 ${b.x},355 ${b.x},${b.y + 24}`;
            return <path key={`${parent}-${id}`} data-edge-kind="support" data-edge-from={parent} data-edge-to={id} d={path} className={`evolution-map__support ${(game.upgrades[parent] ?? 0) > 0 ? 'is-living' : ''}`}/>;
          }))}
        </svg>
        {BIO_IDS.map(id => {
          const point = points[id];
          const owned = (game.upgrades[id] ?? 0) > 0;
          const missing = owned ? [] : requirements(game, id);
          const state = owned ? 'living' : missing.length === 0 ? 'ready' : missing.every(reason => reason.startsWith('Needs ')) ? 'growing' : 'locked';
          const status = owned ? 'Living' : state === 'ready' ? 'Ready' : state === 'growing' ? 'Save resources' : 'Locked';
          return <button key={id} type="button" className={`evolution-node evolution-node--${state} ${selectedId === id ? 'is-selected' : ''} ${guideId === id ? 'is-guided' : ''}`} style={{ left: `${point.x / width * 100}%`, top: `${point.y / height * 100}%`, '--node-tint': point.tint } as React.CSSProperties} onClick={() => onSelect(id)} aria-label={`Inspect ${DEFINITION_MAP[id].name}`} aria-pressed={selectedId === id} aria-describedby={`${instanceId}-${id}-status`} data-evolution-node={id}>
            <span className="evolution-node__core"><EvolutionGlyph id={id}/>{owned && <span className="evolution-node__badge"><Check size={10}/></span>}{state === 'locked' && <span className="evolution-node__badge"><Lock size={9}/></span>}</span>
            <strong>{point.label}</strong><small id={`${instanceId}-${id}-status`}>{status}</small>
          </button>;
        })}
      </div>
    </div>
    <p className="evolution-map__note">One branch among many. Earlier life persists.</p>
  </section>;
}
