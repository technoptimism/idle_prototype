import { Check, ChevronDown, Plus } from 'lucide-react';
import { DEFINITION_MAP, DISCOVERIES, EXTRA_REQUIREMENTS, RESOURCES, quote, requirements } from '../game';
import type { Cost, Definition, GameState, ResourceId } from '../game';
import { briefEffect, formatAmount, shortRequirement } from '../ui';
import './action-card.css';

export function CostTokens({ cost, game, label = 'Purchase cost' }: { cost: Cost; game: GameState; label?: string }) {
  return <div className="cost-tokens cost-line" aria-label={label}>{Object.entries(cost).map(([key, amount]) => {
    const id = key as ResourceId;
    return <span className={game.resources[id] + 1e-8 >= amount! ? 'affordable' : 'unaffordable'} key={id} aria-label={`${formatAmount(amount!, 1)} ${RESOURCES[id].name}`}>
      <span className="cost-symbol" aria-hidden="true">{RESOURCES[id].symbol}</span><span aria-hidden="true">{formatAmount(amount!, 1)}</span>
    </span>;
  })}</div>;
}

const conditionNames: Record<string, string> = {
  density: 'cloud density', cooling: 'cloud cooling', temperature: 'temperature stability',
  waterCoverage: 'water coverage', atmosphere: 'atmospheric protection', nutrients: 'nutrient availability',
};

function allPrerequisites(def: Definition): string[] {
  const ordinary = (def.requires ?? []).map(id => DEFINITION_MAP[id]?.name ?? id);
  const discoveries = (def.discoveries ?? []).map(id => `Discovery: ${DISCOVERIES[id].name}`);
  const extra = (EXTRA_REQUIREMENTS[def.id] ?? []).map(requirement => {
    if (requirement.kind === 'building') return `${requirement.amount} × ${DEFINITION_MAP[requirement.id]?.name ?? requirement.id}`;
    if (requirement.kind === 'condition') return `${requirement.amount}% ${conditionNames[requirement.id]}`;
    return `${requirement.amount}% ${requirement.kind === 'health' ? 'biosphere health' : 'habitability'}`;
  });
  return [...ordinary, ...discoveries, ...extra];
}

export default function ActionCard({ def, game, buy, upgrade = false }: { def: Definition; game: GameState; buy: (id: string) => void; upgrade?: boolean }) {
  const count = (upgrade ? game.upgrades[def.id] : game.buildings[def.id]) ?? 0;
  const pending = upgrade ? 0 : game.cosmos.protostars.filter(star => star.kind === def.id).length;
  const done = upgrade && !def.repeatable && count > 0;
  const missing = requirements(game, def.id);
  const cost = quote(game, def.id);
  const verb = upgrade ? def.repeatable ? 'Improve' : 'Unlock' : 'Build';
  const prerequisites = allPrerequisites(def);
  const descriptionId = `blocker-${def.id}`;
  return <article className={`purchase-card action-card ${done ? 'purchased' : ''}`} data-card-id={def.id} tabIndex={-1} aria-label={def.name}>
    <div className="purchase-heading">
      <span className="action-glyph" aria-hidden="true">{def.icon ?? '✧'}</span>
      <h3>{def.name}</h3>
      {done ? <Check size={17} className="check-icon" aria-label="Completed"/> : (count > 0 || pending > 0) && <span className="owned">{pending > 0 ? `${count} + ${pending} forming` : upgrade ? `Lv ${count}` : `×${count}`}</span>}
    </div>
    {!done && <>
      <p className="action-benefit">{briefEffect(def)}</p>
      <div className="action-purchase"><CostTokens cost={cost} game={game}/><button className={`purchase-button ${missing.length === 0 ? 'ready' : ''}`} disabled={missing.length > 0} aria-label={`${verb} ${def.name}`} aria-describedby={missing.length > 0 ? descriptionId : undefined} onClick={() => buy(def.id)}>{verb}<Plus size={14}/></button></div>
      {missing.length > 0 && <p id={descriptionId} className="requirement action-blocker">{shortRequirement(missing[0])}{missing.length > 1 && <span className="more-requirements"> +{missing.length - 1}</span>}</p>}
    </>}
    <details className="action-details">
      <summary>Details<ChevronDown size={12} aria-hidden="true"/></summary>
      <div className="action-details-body">
        <p>{def.description}</p><p className="full-effect">{def.effect}</p>
        {!done && <p><strong>Cost:</strong> {Object.entries(cost).map(([id, amount]) => `${formatAmount(amount!, 1)} ${RESOURCES[id as ResourceId].name}`).join(' · ')}</p>}
        {prerequisites.length > 0 && <p><strong>Requires:</strong> {prerequisites.join(' · ')}.</p>}
        {missing.length > 0 && !done && <><strong className="requirements-heading">Still needed</strong><ul>{missing.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
      </div>
    </details>
  </article>;
}
