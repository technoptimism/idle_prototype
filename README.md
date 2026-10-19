# Stardust to Civilization

A local, client-side incremental game: develop gas clouds and stars, assemble a world with lasting ecological traits, grow a branching biosphere, then support a civilization through the Space Age. Earlier phases keep running while you explore later ones.

## Run

Use Node 24.x or 26+ with npm.

```sh
npm install
npm run dev
```

Open the local address Vite prints. No account, backend, external artwork, or paid service is required.

## Play

Follow the learning path one step at a time: each goal introduces one mechanic, gives a short reason it matters, and points to the action or process to watch. It covers collection, stellar formation, planetary construction, ecological support, and civilization in smaller steps. The compact upcoming list previews what follows. This is optional guidance: there are no tutorial acknowledgements, automatic purchases, or restrictions on exploring. Existing saves resume at the appropriate chapter without replaying the opening.

Use **Build**, **Research**, and **World** just above the actions in every chapter. The tabs stay with their controls and scroll with the page, and each chapter remembers its last selected tab for the session. **Show next step** in the milestone panel, or **Go to next step** in the bottom dock, takes you to the relevant chapter and tab, opens any needed section, and highlights and focuses the action or missing prerequisite. These shortcuts only navigate; purchases still require your click. On mobile, a compact current goal appears before the world; open **Requirements & info** or the selected inspector for exact costs and missing requirements.

The world is interactive: tap the cosmic cloud to gather hydrogen, then select a collector, habitat, or settlement building to open its inspector. Selection is free; the inspector's purchase button shows the actual cost and uses the same validated economy as every other purchase. Owned collectors, organisms, and buildings appear in the scene with count badges, while forming stars show progress rings. Select the biosphere badge to open free restoration and a link to planetary conditions. The persistent **Gather hydrogen** button and **H** shortcut work in every chapter.

The inspector shows one action at a time. Its card keeps the effect and cost visible; open **Details** for the full explanation and exact missing requirements. Compact catalogs retain every building and upgrade. Biology's interactive evolution map distinguishes ancestral descent from ecological support; selecting a node opens its research inspector. Future unlocks, established research, world-profile choices, discoveries, history, and science notes remain available on demand. On desktop the scene sits beside its inspector; on mobile the current goal leads into the scene and controls below. All production, purchases, planetary choices, saves, and progression rules remain intact.

Gather hydrogen and buy a gas collector first. Clouds develop density and radiative cooling; research can accelerate preparation. Choose an economical small stable star, a stronger Sun-like star, or a massive star that eventually releases heavier elements. Purchases begin protostars: they consume hydrogen while forming, pause safely during shortages, and ignite on a visible timer. Massive stars later end in one supernova.

Assemble the primary planet through accretion, a rocky core, a solid surface, an atmosphere, and oceans. Completed worlds and wetlands turn elemental ingredients into water and prebiotic compounds. Monitor thermal balance, water coverage, atmospheric protection, nutrients, and habitability. Free stabilization helps recover conditions; production still needs its elemental inputs. Extra worlds provide a simple chemistry bonus.

Choose a temperate, ocean-rich, geologically active, or mineral-rich world. These profiles affect chemistry, ecosystems, and civilization; they can be changed freely throughout the journey. Climate regulation and nutrient cycling mitigate their tradeoffs. Tidal pools, reactive mineral surfaces, and ocean vents offer complementary prebiotic habitats. Discoveries from clouds, stellar ignition, enrichment, oceans, and a working water cycle unlock related research. A habitable primary world with enough water and compounds can support the first cells.

Biomass and evolution points support persistent microbial, photosynthetic, and animal lineages. Producers support consumers, while reproduction and efficient metabolism offer complementary ways to grow the biosphere. Humans introduce food, materials, knowledge, and usable energy. Build farms, housing, workshops, schools, and power stations; repair industrial pressure with conservation, restoration, and clean energy. Reach spaceflight and build an Orbital Observatory with at least 60% biosphere health to finish, then continue playing.

The developer panel offers speed controls and phase presets in a separate save slot. It cannot overwrite the normal game. Saves live in your browser's localStorage; offline production follows the same rules, including input-limited protostars and stellar events, and is capped at eight hours. Only the explicitly enabled stellar nursery can buy things while you are away. Unreadable or invalid saves are protected until a successful reload or explicit reset; unavailable storage produces a visible message.

Save schema v2 automatically migrates valid v1 progress in both slots. Established legacy planets receive the completed construction projects and a temperate profile, preserving resources, buildings, upgrades, populations, active stellar timers, and completion. The original `:v1` localStorage key names intentionally remain stable so updates find existing saves. Unsupported or corrupt data is left untouched until an explicit reset.

## Checks and balancing

```sh
npm test
npm run build
npm run verify:journey
npm run verify:guided
```

Adjust typed definitions and `BALANCE` in `src/game/data.ts` to rebalance the game. Star preparation and formation, project costs, discovery prerequisites, habitat effects, and `PROFILE_DEFINITIONS` live there. `src/game/index.ts` owns atomic actions, input-limited recipes, populations, and timed events. `worldEffects` applies planetary traits to the shared economy. `src/components/WorldScene.tsx` draws the interactive scenes; `EvolutionMap.tsx` draws lineage nodes and the distinct ancestral/support connections defined in the game data. Scene selection and the contextual inspector are coordinated in `src/App.tsx`. React renders state but does not determine production: elapsed simulation time does. `src/persistence.ts` owns versioned saves, migration, validation, and offline catch-up. `scripts/playthrough.ts` exercises a fresh normal game using only legal purchases and ordinary production.

`src/progression.ts` derives the learning path from actual progress; its steps do not change costs, lock other purchases, or add save fields. `scripts/guided-playthrough.ts` checks a second fresh game that follows only the current suggested purchase or explicitly offered recovery/automation action, with one hydrogen tap per second during the opening minute and ordinary production afterward. Keep this route reachable when changing the order or suggested production targets.

Both fresh-game verification routes pass using legal purchases and ordinary production, with no presets or resource grants:

| Route | First collector | First life | Humans | Space Age | Observatory | Final health |
| --- | --- | --- | --- | --- | --- | --- |
| Active-player policy | 14 sec | 9.1 min | 20.0 min | 36.3 min | 39.9 min | 100% |
| Current guide only | 15 sec | 8.8 min | 22.0 min | 38.7 min | 42.4 min | 100% |

The guided run visits 65 suggested steps and makes 92 legal purchases. It uses 60 opening hydrogen taps and the free stabilization action only while the guide explicitly offers it; later income comes from normal production. Both routes wait for stars to form and purchase every planetary construction stage. These are observed strategies, not a promise for every investment order. Automated tests cover atomic spending, prerequisites, shortages, phase transitions, cloud preparation, input-limited protostars, timed events, world profiles, habitats, legacy migration, slot isolation, corrupted/unavailable storage, and offline catch-up without repeated rewards.

For browser checks, leave the development server running in another terminal, then run:

```sh
JOURNEY_STATE_PATH=artifacts/legal-completion.json npm run verify:journey
node scripts/browser-check.mjs
```

The browser script uses installed Microsoft Edge on macOS when available, otherwise Playwright Chromium (`npx playwright install chromium` if needed). It checks desktop and 390px mobile layouts, compact initial presentation, free object/map selection, real inspector purchases, cloud gathering, visible ownership, focus during production, star-progress rings, and health-driven vegetation/haze. It also checks reopening detailed controls, continued production across tabs, construction, profiles, habitats, legacy migration, completion, continued play, hidden-tab timing, offline summaries, storage failure, and reset recovery. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another Chromium executable, or `GAME_URL` for a server other than `http://127.0.0.1:5173/`. Screenshots and the browser report are written to `artifacts/`. The optional `JOURNEY_STATE_PATH` export contains the completed state reached through the legal playthrough, for reuse when checking the completion interface. Other browser engines have not been verified.

Future contributors should read [AGENTS.md](AGENTS.md) for working instructions and [the game design notes](docs/GAME_DESIGN.md) for architecture, progression, and expansion guardrails.

## Scientific abstractions

All quantities, conversion ratios, population counts, and timescales are gameplay units. Cloud density, cooling readiness, and planetary conditions are scores rather than physical measurements. Stars form through gravitational collapse; fusion requires stellar conditions. Star feeding, lifetimes, and red-dwarf illumination are deliberately simplified. A supernova releases elements formed during the star's life as well as some produced in the explosion. Planetary assembly and habitability are reduced to staged projects and a few visible requirements; profile adaptation is a reversible game mechanic.

The exact origin of cellular life remains an open scientific question. Tidal pools, mineral surfaces, and vents represent possible complementary settings; buying them does not establish an explanation for abiogenesis. Evolution points are an abstract progression currency, not a physical substance or a conscious purpose. The branching route illustrates selected dependencies and ancestral lineages without reproducing a complete tree of life; earlier organisms persist. Humans are the selected endpoint of this prototype, not evolution's inevitable destination. Biosphere health, food webs, knowledge, and industrial impacts are simplified population-scale systems.
