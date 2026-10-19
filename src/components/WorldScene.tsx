import { useId } from 'react';
import { PROFILE_DEFINITIONS, planetStage } from '../game';
import type { GameState, PlanetProfile } from '../game';
import './world-scene.css';

type WorldSceneProps = { phase: 0 | 1 | 2; state: GameState };

const stars = Array.from({ length: 94 }, (_, index) => ({
  x: (index * 193 + Math.sin(index * 9) * 71 + 1200) % 1200,
  y: (index * 113 + Math.cos(index * 7) * 47 + 560) % 560,
  radius: index % 11 === 0 ? 1.7 : index % 4 === 0 ? 1.1 : 0.65,
  opacity: 0.2 + ((index * 13) % 60) / 100,
}));

const cityLights = [
  [564, 216], [583, 231], [602, 235], [575, 251], [547, 246], [651, 322],
  [667, 333], [679, 348], [627, 301], [731, 219], [746, 233], [754, 255],
  [704, 234], [760, 306], [723, 290], [614, 399], [597, 382],
];

function Cell({ x, y, size, complex, id }: {
  x: number; y: number; size: number; complex: boolean; id: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <ellipse rx="116" ry="77" fill={`url(#${id}-cell)`} stroke="#8edfc1" strokeWidth="1.5" />
      <ellipse rx="106" ry="67" fill="none" stroke="#a8edcf" strokeWidth="0.6" opacity=".4" />
      <path d="M-35-18C-14-44 8 15 30-5S69 21 38 36S1-4-27 16S-59 2-35-18Z" fill="none" stroke="#e4d08f" strokeWidth="3" opacity=".8" />
      {complex && <g><ellipse cx="-8" cy="-4" rx="36" ry="28" fill="#487d79" stroke="#9fe5c9" /><ellipse cx="-8" cy="-4" rx="21" ry="16" fill="#7faaa1" /><circle cx="-12" cy="-5" r="5" fill="#dfd59d" /></g>}
      {[[-65, -23, 19], [62, 18, -20], [40, -39, 42], [-55, 36, -10]].map(([cx, cy, rotation], index) => (
        <g key={index} transform={`translate(${cx} ${cy}) rotate(${rotation})`}>
          <ellipse rx="15" ry="7" fill={complex ? '#cbad72' : '#74b89e'} opacity=".8" />
          <path d="M-9 0Q-5-5-1 0T8 0" stroke="#253e3a" strokeWidth="1.5" fill="none" />
        </g>
      ))}
      {Array.from({ length: 15 }, (_, index) => <circle key={index} cx={Math.sin(index * 17) * 90} cy={Math.cos(index * 13) * 49} r="1.5" fill="#d3ecd0" opacity=".6" />)}
      <path d="M-103-28C-145-20-116 5-153 16S-182 32-166 43" fill="none" stroke="#8edfc1" strokeWidth="1.2" opacity=".6" />
    </g>
  );
}

function Globe({ id, civilization, lush, advanced, profile }: { id: string; civilization: boolean; lush: boolean; advanced: boolean; profile: PlanetProfile }) {
  return (
    <g className="world-globe">
      <circle cx="647" cy="284" r="221" fill={`url(#${id}-atmosphere)`} />
      <circle cx="647" cy="284" r="202" fill={`url(#${id}-ocean)`} stroke="#8ed0c2" strokeWidth="1" />
      <g clipPath={`url(#${id}-globe-clip)`}>
        <g fill={profile === 'mineral' ? '#a6a17d' : profile === 'active' ? '#92916d' : lush ? '#789b6c' : '#9ca17b'} stroke="#b6b391" strokeWidth="1.1" strokeLinejoin="round" transform={profile === 'oceanic' ? 'translate(647 284) scale(.83) translate(-647 -284)' : undefined}>
          <path d="M475 170L509 145 547 149 563 166 592 173 604 196 628 204 626 224 604 231 599 250 570 258 553 240 527 247 518 228 497 230 491 207 468 203Z" />
          <path d="M579 274L602 264 622 280 643 289 662 320 654 349 639 361 632 389 608 416 599 393 602 366 582 343 588 317 573 295Z" />
          <path d="M674 160L711 143 743 158 753 179 781 182 793 203 825 213 841 243 817 266 793 256 775 273 746 261 733 242 704 243 688 220 664 214 664 189Z" />
          <path d="M697 253L725 248 744 269 753 301 737 325 721 337 709 365 688 349 680 317 666 302 677 274Z" />
          <path d="M764 359L799 350 817 370 810 393 782 399 758 382Z" />
        </g>
        {lush && <g fill="#3e7157" opacity={profile === 'oceanic' ? '.4' : '.65'}>
          <path d="M514 185L531 175 549 186 542 209 526 220 510 205Z" />
          <path d="M594 290L613 286 638 313 631 341 607 352 592 328Z" />
          <path d="M691 179L714 172 738 192 727 211 701 209Z" />
          <path d="M689 278L710 269 730 289 724 320 704 328 688 304Z" />
        </g>}
        {profile === 'active' && <g fill="none" stroke="#d3a172" strokeWidth="2" opacity=".5"><path d="M599 293L608 312 606 327M708 281L714 298 709 310M748 204L760 213" /><path d="M591 295L599 287 606 295M700 283L708 274 716 283" strokeWidth="1" /></g>}
        <g fill="none" stroke="#c4e5d9" opacity=".13" strokeWidth=".7">
          <ellipse cx="647" cy="284" rx="202" ry="68" />
          <ellipse cx="647" cy="284" rx="202" ry="143" />
          <ellipse cx="647" cy="284" rx="77" ry="202" />
          <ellipse cx="647" cy="284" rx="151" ry="202" />
          <path d="M445 284H849" />
        </g>
        <g fill="none" stroke="#ebf3df" strokeWidth="9" strokeLinecap="round" opacity=".24">
          <path d="M470 263Q506 246 535 262" /><path d="M632 169Q673 148 711 165" />
          <path d="M714 390Q754 370 790 377" /><path d="M527 378Q549 368 570 374" />
          <path d="M744 286Q784 278 810 296" />
        </g>
        {civilization && <g>
          {cityLights.map(([cx, cy], index) => <g key={index}><circle cx={cx} cy={cy} r="8" fill="#edca81" opacity=".08" /><circle cx={cx} cy={cy} r={index % 3 === 0 ? '2.5' : '1.5'} fill="#f2d38f" /></g>)}
          <g transform="translate(556 221)" fill="#d5d0b3" stroke="#233b36" strokeWidth="1">
            <path d="M-13 8V-5H-5V8ZM-3 8V-15H6V8ZM8 8V-8H17V8ZM20 8V0H27V8Z" />
            <path d="M-3-15L1-20 6-15" fill="#c69667" />
          </g>
          <g transform="translate(713 282)" fill="#d5d0b3" stroke="#233b36" strokeWidth="1">
            <path d="M-12 8V-4H-5V8ZM-2 8V-12H5V8ZM8 8V-1H18V8Z" />
          </g>
          {advanced && <g transform="translate(617 387)" fill="#9cb9b7" stroke="#d6ddd0" strokeWidth=".8"><path d="M-16 6H20L13-8H-8Z" /><path d="M-11 1H15M-8-4H11M-1-8L-3 6M6-8L9 6" fill="none" /></g>}
        </g>}
        <circle cx="647" cy="284" r="202" fill={`url(#${id}-globe-shadow)`} />
      </g>
      <path d="M491 156A202 202 0 0 1 817 175" fill="none" stroke="#c3eadb" strokeWidth="2" opacity=".55" />
      <path d="M481 424A217 217 0 0 0 841 381" fill="none" stroke="#95d0bd" strokeWidth=".7" opacity=".4" />
    </g>
  );
}

export default function WorldScene({ phase, state }: WorldSceneProps) {
  const id = `world${useId().replace(/:/g, '')}`;
  const has = (key: string) => (state.upgrades[key] ?? 0) > 0;
  const sunlikeStars = state.buildings.stableStar ?? 0;
  const stableStars = sunlikeStars + (state.buildings.redDwarf ?? 0);
  const planets = state.buildings.planet ?? 0;
  const stage = planetStage(state);
  const profile = state.planet.profile;
  const profileName = PROFILE_DEFINITIONS.find(item => item.id === profile)?.name ?? 'Temperate world';
  const protostar = state.cosmos.protostars[0];
  const cloudCompression = 1 - state.cosmos.density / 100 * .4;
  const planetScale = stage === 1 ? .46 : stage === 2 ? .7 : 1;
  const massiveStars = state.stars.length;
  const terrestrial = has('land');
  const complex = has('eukaryotes');
  const spaceflight = has('spaceflight');
  const observatory = has('observatory');
  const title = phase === 0 ? stage === 5 ? 'An ocean, and a possibility' : planets > 0 ? 'A world taking shape' : stableStars > 0 ? 'The first light' : protostar ? 'A star in the making' : 'Everything begins with a little dust' : phase === 1 ? terrestrial ? 'A living, breathing world' : complex ? 'A universe within a cell' : 'Life finds a beginning' : observatory ? 'Looking back at the stars' : 'A world we call home';
  const subtitle = phase === 0 ? stage === 5 ? `${profileName}. Water and chemistry begin a new chapter.` : planets > 0 ? ['','Dust gathers into the seed of a rocky world.','A rocky interior emerges from stellar ingredients.','Solid ground. The next step is a protective atmosphere.','An atmosphere surrounds the cooling surface.'][stage] : stableStars > 0 ? 'Inside stars, simple ingredients become new possibilities.' : protostar ? 'Gravity draws gas inward. A steady supply feeds the growing core.' : 'From hydrogen to stars. From stars to everything.' : phase === 1 ? terrestrial ? 'Many branches. One interconnected biosphere.' : 'Small beginnings, extraordinary possibilities.' : spaceflight ? 'The next horizon begins with a healthy home.' : 'Civilization grows from the living world beneath it.';

  return (
    <section className={`world-scene world-scene--${phase}`} aria-label={`Live illustration: ${title}`}>
      <div className="world-scene__eyebrow"><span className="world-scene__coordinate">{['01 / THE COSMOS', '02 / THE BIOSPHERE', '03 / CIVILIZATION'][phase]}</span><span className="world-scene__live"><i /> A WORLD IN MOTION</span></div>
      <svg viewBox="0 0 1200 560" role="img" aria-labelledby={`${id}-title`} preserveAspectRatio="xMidYMid slice">
        <title id={`${id}-title`}>{title}. {subtitle}</title>
        <defs>
          <radialGradient id={`${id}-background`} cx="56%" cy="38%" r="75%"><stop stopColor={phase === 1 ? '#173c3a' : '#17353b'} /><stop offset="1" stopColor="#071b25" /></radialGradient>
          <radialGradient id={`${id}-nebula`}><stop stopColor="#6e9f86" stopOpacity=".2" /><stop offset=".45" stopColor="#557e7b" stopOpacity=".08" /><stop offset="1" stopColor="#16303b" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${id}-halo`}><stop stopColor="#e6b65b" stopOpacity=".4" /><stop offset=".3" stopColor="#ca9a50" stopOpacity=".12" /><stop offset="1" stopColor="#d3b66d" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${id}-sun`} cx="38%" cy="33%"><stop stopColor={sunlikeStars > 0 ? '#fff1b7' : '#ffd0a4'} /><stop offset=".6" stopColor={sunlikeStars > 0 ? '#eac16f' : '#d98e65'} /><stop offset="1" stopColor="#b67b3e" /></radialGradient>
          <radialGradient id={`${id}-rock`} cx="30%" cy="25%"><stop stopColor={stage < 3 || profile === 'active' ? '#d0ad7f' : '#b9c6ad'} /><stop offset=".35" stopColor={stage < 3 ? '#aa7656' : stage < 5 ? '#8b8c75' : profile === 'oceanic' ? '#659aa7' : profile === 'mineral' ? '#7b958e' : '#5e9494'} /><stop offset=".75" stopColor={stage < 5 ? '#575e54' : '#325a65'} /><stop offset="1" stopColor="#102b37" /></radialGradient>
          <radialGradient id={`${id}-atmosphere`}><stop offset=".85" stopColor="#85b8a3" stopOpacity="0" /><stop offset=".91" stopColor="#79c2b4" stopOpacity=".2" /><stop offset="1" stopColor="#89c5b3" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${id}-ocean`} cx="32%" cy="29%"><stop stopColor={profile === 'oceanic' ? '#75b4bc' : '#79aca4'} /><stop offset=".5" stopColor={profile === 'oceanic' ? '#3a798c' : '#467b7a'} /><stop offset="1" stopColor="#16474e" /></radialGradient>
          <radialGradient id={`${id}-globe-shadow`} cx="23%" cy="30%" r="82%"><stop offset=".48" stopColor="#061b23" stopOpacity="0" /><stop offset="1" stopColor="#061b23" stopOpacity=".8" /></radialGradient>
          <radialGradient id={`${id}-cell`}><stop stopColor="#548e79" stopOpacity=".65" /><stop offset=".8" stopColor="#548e79" stopOpacity=".3" /><stop offset="1" stopColor="#a9d6ac" stopOpacity=".5" /></radialGradient>
          <linearGradient id={`${id}-bottom`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#071b25" stopOpacity="0" /><stop offset="1" stopColor="#071b25" stopOpacity=".88" /></linearGradient>
          <clipPath id={`${id}-globe-clip`}><circle cx="647" cy="284" r="202" /></clipPath>
          <clipPath id={`${id}-rock-clip`}><circle cx="799" cy="322" r="103" /></clipPath>
          <filter id={`${id}-blur`}><feGaussianBlur stdDeviation="17" /></filter>
        </defs>
        <rect width="1200" height="560" fill={`url(#${id}-background)`} />
        <ellipse cx="600" cy="240" rx="630" ry="365" fill={`url(#${id}-nebula)`} transform="rotate(-20 600 240)" />
        <g className="world-stars">{stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.radius} fill={index % 7 === 0 ? '#e4c68b' : '#e1e9db'} opacity={star.opacity} />)}</g>
        <g fill="none" stroke="#b2c2b3" strokeWidth=".6" opacity=".13"><path d="M0 280H1200M600 0V560" /><circle cx="600" cy="280" r="252" /><path d="M36 69V54H51M1149 54H1164V69M36 489V504H51M1149 504H1164V489" /></g>

        {phase === 0 && <g>
          <g fill="none" stroke="#a3b7aa" strokeWidth=".8">
            <ellipse cx="564" cy="257" rx="437" ry="134" transform="rotate(15 564 257)" opacity=".25" />
            <ellipse cx="564" cy="257" rx="338" ry="103" transform="rotate(15 564 257)" opacity=".13" strokeDasharray="2 7" />
            <ellipse cx="564" cy="257" rx="508" ry="178" transform="rotate(15 564 257)" opacity=".09" />
          </g>
          <circle cx="371" cy="225" r="226" fill={`url(#${id}-halo)`} className="world-sun-halo" />
          {stableStars > 0 ? <g className="world-sun" transform={sunlikeStars === 0 ? 'translate(371 225) scale(.77) translate(-371 -225)' : undefined}><circle cx="371" cy="225" r="77" fill={`url(#${id}-sun)`} /><circle cx="371" cy="225" r="83" fill="none" stroke="#e7c580" strokeWidth=".7" opacity=".3" /><path d="M324 198Q362 170 410 199M309 224Q348 201 426 225M324 253Q363 230 421 251" fill="none" stroke="#f2d595" strokeWidth="1" opacity=".25" /></g> : <g transform={`translate(371 225) scale(${cloudCompression}) translate(-371 -225)`}>
            <g filter={`url(#${id}-blur)`} opacity=".8"><ellipse cx="387" cy="226" rx="100" ry="37" fill="#c2b891" transform="rotate(-24 387 226)" /><ellipse cx="350" cy="223" rx="104" ry="26" fill="#9cbdb1" transform="rotate(18 350 223)" /></g>
            <ellipse cx="371" cy="225" rx="114" ry="46" fill="none" stroke="#c3ccb6" strokeWidth=".8" opacity=".5" transform="rotate(-24 371 225)" /><ellipse cx="371" cy="225" rx="77" ry="28" fill="none" stroke="#e3d6ad" strokeWidth=".8" opacity=".4" transform="rotate(-24 371 225)" />
            <circle cx="371" cy="225" r={protostar ? 14 + (1 - protostar.remaining / protostar.total) * 40 : 5 + state.cosmos.density * .07} fill="#e8d5a2" /><circle cx="371" cy="225" r={protostar ? 8 + (1 - protostar.remaining / protostar.total) * 16 : 2} fill="#fff0bf" />
          </g>}
          {stableStars > 0 && protostar && <g className="world-protostar"><ellipse cx="581" cy="164" rx="58" ry="13" fill="none" stroke="#c0b385" strokeWidth=".7" transform="rotate(-18 581 164)" /><circle cx="581" cy="164" r={7 + (1 - protostar.remaining / protostar.total) * 16} fill="#e0bf83" /><circle cx="581" cy="164" r="43" fill={`url(#${id}-halo)`} /></g>}
          {massiveStars > 0 && <g><circle cx="929" cy="148" r="67" fill={`url(#${id}-halo)`} /><circle cx="929" cy="148" r="19" fill="#e9a477" /><circle cx="929" cy="148" r="24" fill="none" stroke="#e2a77d" strokeWidth=".7" opacity=".45" /><path d="M929 119V107M929 177V189M900 148H888M958 148H970" stroke="#d5b18a" strokeWidth=".7" /></g>}
          {planets > 0 ? <g transform={`translate(799 322) scale(${planetScale}) translate(-799 -322)`}>
            {stage >= 4 && <><circle cx="799" cy="322" r="111" fill="none" stroke="#87b2b0" strokeWidth=".8" opacity=".5" /><circle cx="799" cy="322" r="119" fill="none" stroke="#87b2b0" strokeWidth="5" opacity=".08" /></>}
            {stage === 1 && <g fill="none" stroke="#b1a98a" opacity=".6"><ellipse cx="799" cy="322" rx="210" ry="69" transform="rotate(-18 799 322)" /><ellipse cx="799" cy="322" rx="165" ry="43" transform="rotate(-18 799 322)" strokeDasharray="3 5" /></g>}
            <circle cx="799" cy="322" r="103" fill={`url(#${id}-rock)`} />
            <g clipPath={`url(#${id}-rock-clip)`} opacity={stage < 3 ? '.13' : profile === 'oceanic' ? '.27' : '.45'} fill={profile === 'mineral' ? '#c0b58a' : '#b5b698'}><path d="M699 278L738 257 762 264 774 291 759 319 737 325 725 308 697 313Z" /><path d="M792 241L830 231 861 260 854 284 826 297 815 276 791 273Z" /><path d="M780 346L800 330 827 347 824 372 799 404 779 384Z" /></g>
            {stage === 2 && <g fill="none" stroke="#e7ba84" opacity=".45"><path d="M719 292Q786 271 866 307M728 339Q801 315 883 347M764 239Q805 316 779 407" strokeWidth="3" /><circle cx="799" cy="322" r="64" strokeWidth=".7" /></g>}
            {stage >= 4 && <g fill="none" stroke="#d0e4d6" opacity=".28" strokeWidth="4" strokeLinecap="round"><path d="M720 304Q745 295 767 304M815 271Q840 262 859 274M789 377Q817 366 842 372" /></g>}
            {profile === 'active' && stage >= 3 && <path d="M779 348L792 362 787 380M830 261L840 278 836 288" stroke="#e0a36e" strokeWidth="2" fill="none" opacity=".7" />}
            <path d="M724 253A103 103 0 0 1 863 242" stroke="#d5dfc5" strokeWidth="1.5" fill="none" opacity=".5" />
            <circle cx="924" cy="367" r="13" fill="#789091" /><circle cx="924" cy="367" r="18" fill="none" stroke="#8fa9a5" strokeWidth=".5" opacity=".4" />
          </g> : <g opacity=".55">
            <circle cx="799" cy="322" r="37" fill="#26444b" /><circle cx="799" cy="322" r="52" fill="none" stroke="#829b94" strokeWidth=".5" strokeDasharray="2 5" />
            <g fill="#8da699">{Array.from({ length: 23 }, (_, index) => <circle key={index} cx={799 + Math.cos(index * 1.9) * (45 + index * 1.9)} cy={322 + Math.sin(index * 1.9) * (20 + index * 1.1)} r={index % 3 === 0 ? '2' : '1'} />)}</g>
          </g>}
          <g className="world-svg-label" fill="#c2cfc2"><path d="M371 312V344H290" stroke="#a7baaa" strokeWidth=".65" fill="none" opacity=".5" /><circle cx="371" cy="312" r="2" fill="#d1bc81" /><text x="289" y="361" textAnchor="end">{stableStars > 0 ? sunlikeStars > 0 ? 'STELLAR FUSION' : 'A SMALL, STEADY LIGHT' : protostar ? 'A GROWING PROTOSTAR' : 'A CLOUD OF POSSIBILITY'}</text><path d="M799 437V453H936" stroke="#a7baaa" strokeWidth=".65" fill="none" opacity=".5" /><text x="940" y="457">{planets > 0 ? `WORLD ASSEMBLY · ${stage}/5` : 'FUTURE WORLDS'}</text></g>
        </g>}

        {phase === 1 && !terrestrial && <g>
          <g fill="none" stroke="#77a99b" opacity=".12"><path d="M0 167Q210 70 424 164T833 158T1200 144M0 345Q225 245 442 342T833 333T1200 320M0 379Q225 279 442 376T833 367T1200 354" /><circle cx="651" cy="266" r="194" strokeDasharray="2 8" /><circle cx="651" cy="266" r="218" /></g>
          <g className="world-cell-float"><Cell x={651} y={267} size={1.55} complex={complex} id={id} /></g>
          <g className="world-cell-drift" opacity=".45"><Cell x={264} y={170} size={0.55} complex={false} id={id} /><Cell x={985} y={383} size={0.7} complex={complex} id={id} /></g>
          {has('multicellular') && <g opacity=".65"><Cell x={391} y={387} size={0.44} complex id={id} /><Cell x={439} y={366} size={0.47} complex id={id} /><Cell x={489} y={389} size={0.44} complex id={id} /></g>}
          {has('photosynthesis') && <g fill="#a4c88c" opacity=".6">{Array.from({ length: 20 }, (_, index) => <circle key={index} cx={80 + (index * 173) % 1070} cy={120 + (index * 83) % 320} r={index % 3 + 1.5} />)}</g>}
          <g className="world-svg-label" fill="#b6d2bf"><path d="M751 187L810 123H912" fill="none" stroke="#a7baaa" strokeWidth=".65" opacity=".5" /><circle cx="751" cy="187" r="2" /><text x="923" y="127">{complex ? 'COMPLEXITY, TOGETHER' : 'A SIMPLE CELL'}</text><text x="197" y="416">AN OCEAN OF POSSIBILITY</text></g>
        </g>}

        {(phase === 2 || phase === 1 && terrestrial) && <g>
          <ellipse cx="647" cy="284" rx="360" ry="119" transform="rotate(-20 647 284)" fill="none" stroke="#b8ccb8" strokeWidth=".7" opacity=".22" strokeDasharray={spaceflight ? undefined : '2 8'} />
          <Globe id={id} civilization={phase === 2} lush={has('photosynthesis')} advanced={has('electricity')} profile={profile} />
          {spaceflight && <g className="world-satellite" transform="translate(958 153) rotate(-25)"><path d="M-16-8H-47V8H-16ZM16-8H47V8H16Z" fill="#4d777a" stroke="#b0c2b3" strokeWidth="1" /><path d="M-37-8V8M-27-8V8M27-8V8M37-8V8M-47 0H-16M16 0H47" fill="none" stroke="#a8bbad" strokeWidth=".6" /><rect x="-12" y="-11" width="24" height="22" rx="2" fill="#c6c8ae" /><path d="M-5-11L1-23 8-11M0 12V24M-8 23Q0 31 8 23" stroke="#c6c8ae" fill="none" strokeWidth="1.5" /><circle r="4" fill="#d0a565" /></g>}
          {observatory && <g transform="translate(302 322) rotate(23)"><path d="M-35-10H-10V10H-35ZM10-10H35V10H10Z" fill="#557e88" stroke="#afc9b8" /><rect x="-7" y="-22" width="14" height="41" rx="3" fill="#d1c7a6" /><ellipse cy="-22" rx="7" ry="4" fill="#172f37" stroke="#d1c7a6" /><path d="M-7 14L-15 24M7 14L15 24" stroke="#d1c7a6" /></g>}
          <g className="world-svg-label" fill="#bfd0bb"><path d="M461 210L371 170H256" fill="none" stroke="#a7baaa" strokeWidth=".65" opacity=".5" /><circle cx="461" cy="210" r="2" /><text x="256" y="158">{phase === 2 ? 'OUR SHARED HOME' : 'LIFE ON LAND'}</text><path d="M818 389L887 420H1005" fill="none" stroke="#a7baaa" strokeWidth=".65" opacity=".5" /><circle cx="818" cy="389" r="2" /><text x="889" y="440">{spaceflight ? 'A NEW PERSPECTIVE' : 'ONE LIVING SYSTEM'}</text></g>
        </g>}
        <rect y="365" width="1200" height="195" fill={`url(#${id}-bottom)`} pointerEvents="none" />
      </svg>
      <div className="world-scene__caption"><h2>{title}</h2><p>{subtitle}</p></div>
      <span className="world-scene__scale" aria-hidden="true"><i /><i /><i /><i /><i /> NOT TO SCALE</span>
    </section>
  );
}
