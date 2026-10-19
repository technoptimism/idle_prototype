# Stardust to Civilization — project guidance

## Product intent

- This is one connected, client-side React/TypeScript/Vite idle game. Cosmic development supplies planetary ingredients; biology is the centerpiece; civilization depends on the living world.
- Preserve all three playable phases and continued play after the Orbital Observatory. Earlier phases keep producing regardless of the selected screen.
- Expand depth through meaningful dependencies, conditions, and persistent world traits. Keep the resource inventory compact and explain each resource's source and purpose.
- Pacing targets for a fresh active game: first collector within about 60 seconds, first cellular life around 8–12 minutes, and completion around 30–45 minutes. Treat these as game balance, not scientific timescales.
- World and upgrade choices may change efficiency or resource demand. Every world must retain a reachable human route, with recoverable shortages and freely accessible essential recovery actions.
- No backend, accounts, required external artwork/fonts, or paid services. Use local SVG/CSS and the existing visual style.

## Architecture and economy

- `src/game/types.ts`: state, actions, conditions, and definition types.
- `src/game/data.ts`: typed definitions, costs, prerequisites, profiles, effects, and balancing constants. Put new tuning knobs here.
- `src/game/index.ts`: pure elapsed-time simulation, atomic validated actions, recipes, one-time events, milestone guidance, and derived UI information.
- `src/persistence.ts`: save validation, schema migration, independent normal/developer slots, and offline catch-up.
- `src/useGame.ts`: browser clocks, visibility handling, autosave, and UI dispatch. UI rendering does not determine production.
- `src/components/`: reusable controls and local world artwork. `ActionCard` provides concise purchases with complete information in Details; `CosmicSystems` groups world controls. Keep displayed costs and missing requirements tied to simulation helpers.
- `src/ui.ts`: presentation summaries and formatting only. Action tabs filter what is shown; they must never alter simulation, affordability, or progression.
- `src/progression.ts`: derive a chaptered learning path from actual game progress. Keep lessons, suggested production targets, and navigation together; guidance must not mutate state, add save flags, or restrict free exploration.
- Validate actions at the state boundary. Reject unknown IDs, unmet prerequisites, duplicate milestones, invalid costs, and partial spending. Keep all numeric state finite and nonnegative.
- Limit recipes by available inputs. Protostar feeding, planetary chemistry, biology, and civilization must obey the same rules in foreground and offline play.
- Resolve event boundaries accurately; ignition and supernova rewards must occur once. Never use timer callback counts as elapsed game time.

## Saves and compatibility

- Preserve existing saves when extending state. Migrate valid older schemas; do not silently reset, delete, or overwrite unreadable data.
- Storage keys are compatibility identifiers. Changing the state/envelope version does not justify abandoning existing save slots.
- Keep developer speed controls and phase presets isolated from normal progress. Prevent slot switching from discarding unsaved in-memory progress when storage fails.
- Offline production is capped at eight hours and uses ordinary simulation/event rules. Only explicitly authorized automation may buy things. Consume each offline interval once.
- Hidden autosaves must retain the simulation's last processed timestamp. Advance the hidden interval once when returning; do not count it again on reload.

## Presentation and science

- Default to a concise interface: relevant resources, the next milestone, and a small set of available actions. Use the same Build, Research, and World tabs in every chapter, directly above their action panel; retain each chapter's selected tab during the session. The user prefers these tabs alongside the controls: let chapter navigation and action tabs scroll with the page rather than pinning a global toolbar at the top. Keep future actions, scientific explanations, history, and detailed modifiers collapsed until requested.
- Keep next-step guidance one click away. Milestone and dock shortcuts should navigate to the relevant chapter and tab, reveal any collapsed section, and highlight and focus the action or missing prerequisite. Guidance must only navigate; never spend resources or enable automation. On mobile, place the current goal before the world illustration.
- Teach progression through small, useful steps across every chapter: one current concept sentence, one concrete action or process to watch, exact outstanding requirements, and a short collapsed preview. Introduce production sources before spending demands, explain waiting and shortages, and spread production growth between major unlocks. Existing saves should skip completed chapters; avoid repeated opening lessons and mandatory tutorial acknowledgements.
- Show costs and short effects on action cards. Keep every exact missing requirement, prerequisite, and full explanation available through touch-accessible Details. Locked controls must not rely on hover tooltips. Preserve every action and all economy rules when simplifying presentation.
- Support keyboard controls, responsive layouts, readable contrast, and reduced motion. Retain the scientific field-journal appearance and evolving local SVG world.
- Keep the persistent Gather hydrogen control consistent across chapters: the same styling, size, label, yield, shortcut, and first position in its action row at each viewport size.
- Label quantities, ratios, population counts, stellar timing, climate controls, and life-emergence thresholds as gameplay abstractions.
- Explain gravitational star formation and fusion under stellar conditions. A supernova releases elements made during stellar life, plus some formed in the explosion.
- The origin of life remains an open scientific question. Prebiotic habitats are complementary game models, not claims that one particular origin is established.
- Evolution points are an abstract currency. Distinguish ancestral lineage from ecological support; humans are a selected route, not evolution's inevitable goal.

## Verification and documentation

- Run `npm test` and `npm run build` for simulation, state, or interface changes, with focused regression cases for new behavior.
- Run `npm run verify:journey` after changing progression or balance. This starts fresh and uses only legal actions and normal production; developer presets cannot establish reachability.
- Run `npm run verify:guided` after changing the learning path. Its fresh normal game follows only the current suggested purchase or explicitly offered free/automation action; it must also reach the full objective through ordinary production.
- For browser checks, start `npm run dev`, then run `JOURNEY_STATE_PATH=artifacts/legal-completion.json npm run verify:journey` and `node scripts/browser-check.mjs`.
- Browser checks use installed macOS Edge or Playwright Chromium. Inspect desktop and mobile screenshots and fix observed errors. Report the browser engines actually checked.
- Keep screenshots, generated test states, and reports under ignored `artifacts/`. Never seed a user's real browser profile with verification fixtures.
- Update `README.md` for setup/system changes and `docs/GAME_DESIGN.md` for new mechanics, tradeoffs, balancing rationale, and deferred ideas. Document observed verification results rather than assuming they still pass.
