# Game design and future development notes

## The connected journey

The opening is a star-system construction game whose results remain part of the later ecosystem. Stars supply elements, the primary planet processes them, persistent organisms support consumers, and civilization depends on both planetary ingredients and biosphere health. Biology remains the central phase.

The expansion keeps the existing thirteen resource currencies. Cloud readiness and planetary suitability are conditions, construction is a sequence of projects, and discoveries are permanent observations. None of these needs another spendable currency.

Target pacing remains: first automation within roughly one minute, life around 8–12 minutes, and a fresh active completion around 30–45 minutes. Extra depth should provide decisions and overlapping processes within those times.

## Presentation: show decisions first

The player's preferred interface is compact. Keep the resource bar, evolving world, next milestone, and current actions easy to scan. Show one group of actions at a time through the same Build / Research / World tabs in every chapter, directly above their controls rather than pinned globally at the top. Interface tabs select content only and never pause or change simulation.

Purchase cards show one concise effect, the current cost, and the action. Details retain the fuller description and exact missing requirements for touch and keyboard access. Group distant unlocks and established milestones into collapsed sections. World-profile options, discovery notes, milestone history, and science explanations should be available on demand rather than all expanded by default. Conditions and recovery controls belong together in World.

This is progressive disclosure, not a reduction of the economy: preserve every producer, research option, lineage, construction stage, habitat, profile, automation switch, recovery action, and save control. The next milestone still lists exact outstanding requirements; disabled purchases must lead to a readable explanation. Do not replace information with hover-only tooltips.

When adding future systems, start with a short label, useful effect, and clear action. Add explanation behind an accessible disclosure and avoid repeating the same instruction in the scene, card, sidebar, and footer. Browser checks record fresh-screen visible word/card counts and verify that hidden controls can be reopened and used without changing production.

## Learning path: smaller steps, one idea at a time

The journey now recommends intermediate steps rather than jumping directly from one major milestone to the next. Its compact current lesson explains one causal link, such as collectors replacing tapping, hydrogen feeding a forming star, a supernova supplying rocky ingredients, producers supporting consumers, or schools increasing knowledge. A goal can be a purchase, a measured condition, or a visible timed process; waiting should explain what is running and what can slow it.

Suggested production growth is interleaved with discoveries and major unlocks. This gives players time to use each new system and avoids demanding a large resource cost before they understand its source. Reproduction and metabolism remain complementary choices, older organisms remain useful, and civilization still requires a productive biosphere. Repeated growth goals use a visible target count and next-purchase cost rather than a new currency or a checklist of repeated instructions.

The guide is a pure projection of the current game in `src/progression.ts`. It never purchases, enables automation, pauses production, or adds compulsory tutorial gates. Players can explore and buy any legal action at any time. New saves begin with collection; advanced saves derive their current chapter from established life and human milestones, without replaying prior chapters or changing the save schema. Shortcuts use the existing local action tabs, reveal the relevant control, and focus it. Preview lessons remain collapsed.

Verify both the existing broad active-player policy and the step-by-step guided policy. `npm run verify:guided` starts fresh, buys only the purchase currently recommended by the guide, performs an explicitly indicated free recovery or nursery switch, taps once per second for the first minute, and otherwise advances ordinary production. It rejects invalid resources and must reach the same Space Age/Observatory objective with at least 60% biosphere health. Developer presets do not prove that the instructions form a usable route.

## Expanded cosmic loop

1. Gather hydrogen and invest in collectors. Manual gathering remains available throughout the game.
2. Assemble a gas cloud and develop its density and cooling. Improvements accelerate preparation; elapsed-time processes also provide progress.
3. Choose a stellar profile. A purchase reserves a cloud and begins a protostar, which consumes hydrogen while growing. Limited hydrogen slows maturation safely.
4. Mature small stable stars offer economical support; Sun-like stars offer stronger steady fusion; massive stars provide delayed elemental enrichment after ignition and their final supernova.
5. Use those elements to assemble the primary planet through accretion, core formation, surface formation, atmosphere, and oceans. Additional worlds support the primary planet through simple bonuses.
6. Manage thermal balance, water coverage, atmospheric protection, and nutrient availability. These are normalized game suitability scores, not a climate model.
7. Develop complementary prebiotic habitats, then establish the first cellular biosphere when the visible conditions and resource requirements are met.

Cloud formation, hydrogen collection, stellar maturation, and existing production can overlap. Purchasing a star authorizes its advertised feeding process. Nursery automation authorizes only the repeatable cloud-and-massive-star cycle; planetary projects and research remain deliberate player purchases.

## Persistent planetary choices

The primary world's profile can be revised without resetting. The available profiles are balanced, ocean-rich, geologically active, and mineral-rich. Their production and demand modifiers are centralized in `PROFILE_DEFINITIONS`; `worldEffects(state)` exposes the combined effects used by the simulation and UI.

- Ocean-rich worlds emphasize aquatic productivity and water availability, with a terrestrial-development tradeoff.
- Active worlds emphasize geochemistry and nutrients, with greater industrial environmental pressure.
- Mineral-rich worlds emphasize material production, with greater environmental pressure.
- Balanced worlds provide the neutral starting route.

Profile changes never remove milestones or block the human route. Climate regulation, nutrient cycling, complementary habitats, and free stabilization provide ways to improve a world. Resource shortages slow processes rather than causing irreversible extinction.

Traits must have actual consequences in later phases: biomass and evolution output, environmental demand, food production, material production, or industrial pressure. Show those consequences where players can use them to make a decision.

## Prebiotic habitats and discovery

Shallow pools, mineral surfaces, and ocean vents are complementary investments. They alter chemical or biological productivity and can all be developed in the same run. They model plausible environments at a broad game level; the exact origin of life is unresolved.

Observing a cloud, fusion, stellar enrichment, oceans, and an operating water cycle unlocks relevant research. A discovery is recorded once, remains available after resources are spent, and never acts as a spendable point balance.

## Scientific and mechanical boundaries

- Star formation is gravitational collapse; fusion starts after ignition under stellar conditions. A gas cloud and a protostar are not already functioning stars.
- A massive star first matures into an active star, then completes its separate stellar-life timer and explodes once.
- A supernova releases life-formed elements along with some formed during the explosion. Ratios, feeding demands, lifetimes, and yields are simplified gameplay units.
- Constructing an atmosphere or changing a planet's profile represents a game-scale adjustment to planetary processes, not literal engineering by a pre-human civilization.
- Thermal balance is a suitability score, not degrees Celsius. Keep its label and units honest.
- Photosynthetic support and ancestral descent are distinct relationships. Earlier lineages persist and humans remain a selected endpoint.

## Implementation and verification

Use `src/game/data.ts` for costs, conditions, profile multipliers, and tuning. Use simulation helpers for UI quotes, requirements, stage progress, and derived effects. Add fields through validated save migration; older completed or life-bearing planets retain their completed construction stages.

A fresh legal run is the balancing reference: `npm run verify:journey`. It must use `createGame`, legal actions, and ordinary elapsed-time production. Developer presets and rich browser fixtures verify screens and controls, but do not prove progression is attainable.

Keep tests focused on boundaries: resource spending, input-limited protostar feeding, event ordering, one-time ignition/rewards, project dependencies, reversible traits, inherited effects, migration, and offline equivalence. Browser checks should exercise new controls and include desktop/mobile layouts, hidden-tab catch-up, save isolation, invalid saves, and continued play after completion.

## Deferred ideas

A brief cooling-universe prologue before hydrogen was discussed as an optional later expansion. It is outside this expansion. Other potential directions include more detailed food webs, nutrient cycling between lineages, and stronger climate/civilization feedbacks. Preserve compact presentation and a recoverable route before adding more systems.

## Expansion verification snapshot

The expanded fresh-game policy reaches its first collector at 14 seconds, first cells at 9.1 minutes, humans at 20 minutes, the Space Age at 36.3 minutes, and the Observatory at 39.9 minutes with 100% biosphere health. It makes 94 legal purchases without presets or injected resources. Automated checks cover the new rules and version-1 save migration; desktop and 390px mobile Edge checks cover the complete interface and lifecycle behavior. Re-run the documented commands after changing balance; this is an observed baseline, not a promise for every strategy.
