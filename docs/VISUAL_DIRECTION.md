# Playable-world visual direction

The visual pass makes the world the main interface while preserving the existing simulation, economy, saves, and optional learning path. It uses local 2D SVG and CSS rather than a 3D engine or external artwork.

## The world and its inspector

The large scene shows what the player owns and what is working. Selecting an object opens a compact inspector with its name, one effect, exact cost, and purchase action. Selection is free and never purchases anything. Build / Research / World remain beside the inspector, directly above its controls; compact catalogs retain every action. The resource HUD stays small, with source and purpose available on tap.

The current learning step still explains one mechanic and offers exact outstanding requirements. Its shortcut opens the relevant inspector and focuses its control. Detailed explanations, future actions, history, and science remain available on demand rather than covering the world.

## Three connected scenes

| Phase | Visible ownership | Main interactions |
| --- | --- | --- |
| Cosmos | Collectors around a gas cloud, forming and ignited stars, and a rocky world assembled in stages. | Gather from the cloud, inspect collectors and stellar roles, watch hydrogen-fed formation, and open planet construction. |
| Biology | Microbial colonies, producer habitats, and persistent lineages across an ocean and terrestrial ecosystem. | Inspect habitats and growth; select connected evolution nodes for research. |
| Civilization | Farms, homes, workshops, schools, power, restoration, and the final Observatory. | Inspect and expand settlement buildings; see biosphere health affect greenery and industrial haze. |

Biology remains the centerpiece. The evolution map distinguishes ancestry from ecological support. Earlier organisms persist, and humans remain one selected route rather than an inevitable endpoint.

## Feedback and accessibility

Gathering gives a short particle/floating-amount response. Purchases immediately change the visible object or count. Protostar and stellar-life rings show processes already running in the simulation. Milestone changes transform the scene without requiring tutorial acknowledgements.

Draw a bounded number of instances and use accurate badges for larger populations. Do not animate thousands of objects. Scene controls have readable names, keyboard access, visible focus, and touch targets. Reduced motion keeps static ownership, progress, and guidance visible. The consistent Gather hydrogen button and H shortcut remain available in every chapter.

On desktop, the scene and inspector sit side by side. On mobile, the current goal appears before the scene, followed by the compact inspector. Decorative movement must never be necessary to understand an action or a shortage.

## Implementation boundaries

Objects, timer rings, conditions, ownership, and map connections derive from actual game state. Rendering does not advance time, determine production, or award rewards. All purchases route through the existing atomic action boundary; gathering from the scene uses the ordinary gather action. No new save fields or balance changes are required for this presentation pass.

Regression checks should cover free selection versus paid purchase, cloud gathering, visible ownership after a purchase, stellar timers, map selection and edge types, settlement ownership and health, keyboard controls, reduced motion, and mobile layouts. Rich screen fixtures establish interface coverage; the independent fresh-game legal and guided journeys establish reachability.
