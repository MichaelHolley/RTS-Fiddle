# AGENTS.md

Browser 3D RTS prototype: Vite + TypeScript + Shallot (WebGPU ECS engine), Bun. The map is a flat ground plane; units use the Blender-made trooper model.

## User context

The user has very little game dev experience; assume none. Be proactive:

- Bring forward technical recommendations while implementing, especially performance or efficiency wins (e.g. moving per-unit work to a shader, GPU instancing, spatial partitioning for separation/picking).
- Raise game design ideas, mechanics, or concerns of high value (RTS pitfalls like pathfinding at scale, selection UX, balance, scope creep), briefly and with a recommendation.
- Explain game-dev jargon in a sentence when first used. Skip low-value suggestions.

## Workflow

This is a vibe-coded MVP:

- No tests are required.
- Validate with `bun run typecheck` (runs `bun check`) and `bun run build`.
- Commit directly to `main`; no feature branches or PRs needed. Use conventional commit messages.

## Structure

- `src/main.ts` – `runApp` bootstrap
- `src/app.ts` – `RtsPlugin`, depends on every plugin below
- `src/config.ts` – all tuning constants, including the unit type table (`UNIT_TYPES`), starting army (`ARMY`) and every game key binding (`KEYS`; check it for clashes before binding a key)
- `src/camera/` – RTS camera (drives `Orbit` in Manual mode)
- `src/units/` – `components.ts` (ECS components), `units.ts` (`UnitsPlugin`, army spawning), `movement.ts` (unit marching, soldier movement to slots), `separation.ts` (spatial-hash push-apart and right of way), `animation.ts` (run cycle and LOD frame swap), `model.ts` (trooper GLB, material, LOD distance), `lodDebug.ts` (L-key LOD highlight), `formation.ts` (order planning – right-click move, right-drag frontage, split, join – and slot math)
- `src/input/` – unit selection, control groups, move orders, ground picking
- `src/scene/` – world setup, GLB loader, color conversion
- `src/ui/` – world-space line markers and DOM HUD/selection box
- `assets/trooper.blend` – trooper source: mesh, rig, `Run` action, and the text blocks `build_trooper.py` (rebuilds mesh + rig + palette) and `export_trooper.py` (bakes frames, writes the GLB)
- `public/models/trooper.glb` – exported unit model

## Total War reference

Controls, terms and mechanics copy Total War (Warhammer / Three Kingdoms era). When adding or changing a mechanic, match how Total War does it unless told otherwise, and call out any deliberate deviation.

### Units and soldiers

A **unit** is the selectable block (`Unit` entity: type, center, destination, facing, files × ranks); a **soldier** is one trooper (`Soldier` entity: owning unit plus a fixed slot in the unit's formation). **Files** are columns and **ranks** are rows; the front rank's width is the **frontage**. "Group" is reserved for Total War's Ctrl+G grouping of several units. Selection, control groups and orders work on units, never single soldiers.

A **unit type** (`UnitTypeId`, stats in `UNIT_TYPES`) holds per-type stats: name, full-strength size and starting files. There is only `Trooper` so far; to add a type, add an id and a `UNIT_TYPES` entry and list it in `ARMY`. All types still share the trooper model and the global speed constants.

### Controls

- **Camera** (`src/camera/rtsCamera.ts`): WASD/arrows or screen-edge pan, Q/E or middle-drag rotate, wheel zoom. Pan speed scales with zoom distance. Camera keys are ignored while Ctrl is held, so Ctrl+A doesn't pan.
- **Browser shortcuts** (`src/input/browserShortcuts.ts`): every key's browser default is cancelled except reload (F5, Ctrl+R), fullscreen (F11), dev tools (F12, Ctrl+Shift+I/J/C) and Cmd combos. Ctrl+W/T/N/Tab can't be blocked by any page, so never bind them.
- **Select**: left-click picks the unit of the nearest soldier on screen within `CLICK_SELECT_RADIUS_PX`; clicking empty ground deselects. Left-drag box-selects every unit with any soldier inside the box. Double-clicking a unit (within `DOUBLE_CLICK_MS`) selects every unit of its type. Shift adds to the selection. Ctrl+A selects all.
- **Control groups**: Ctrl+digit stores the selection (an empty selection clears the group); digit recalls it, Shift+digit adds it. The HUD shows each group's key and unit count.
- **Move** (right-click): the selection keeps its relative layout and each unit its frontage, rotated to face the direction of travel from the selection's center to the click (`planMove`). A ring pings the click point.
- **Frontage** (right-drag past `DRAG_THRESHOLD_PX`): the drag line becomes the combined front rank (`planFrontage`). Units are placed in their current left-to-right order along the line, each getting width in proportion to its soldier count with `UNIT_GAP` between units and at least `UNIT_MIN_FILES` files. The drag direction is the units' right, so dragging left-to-right on screen faces away from the camera. Footprint outlines with a facing arrow preview the result while dragging.
- **Split** (X): each selected unit with at least `UNIT_SPLIT_MIN_SOLDIERS` (9) soldiers splits into a left and a right half standing side by side on its front rank (`planSplit`). The right half is a new unit that joins the original's control groups; both stay selected. Deliberate deviation: Total War has no in-battle split.
- **Join** (C): only units of the same type merge. For each type in the selection, the largest selected unit absorbs the others and reforms at their soldier-weighted center with their fronts combined (`planJoin`); absorbed units are destroyed and replaced in control groups. Deviation: Total War only merges in the campaign and caps the merged unit at full strength.
- Selected units show a ring under each soldier and their destination footprint until they arrive.

### Formation movement

- A unit marches as a block: its center advances at `UNIT_SPEED` toward the destination only while every soldier is within `UNIT_REFORM_DISTANCE` of its slot, so the formation waits for stragglers instead of stretching out.
- Soldiers run (`SOLDIER_SPEED`, faster than `UNIT_SPEED` so they can catch up) to their slot, face the march direction while moving and the unit's facing once it stops. Idle soldiers pushed more than `UNIT_DRIFT_DISTANCE` off their slot walk back.
- On a new order, `assignSlots` gives the front ranks to the soldiers already most forward along the new facing, left to right, so paths cross as little as possible. Soldiers keep that slot until the next order.
- Soldiers push apart using a uniform grid (spatial hash) so each soldier only checks nearby cells. Within a unit they keep `2 × SOLDIER_RADIUS` apart. Soldiers of different units only keep `FORMATION_SPACING / 2` apart, so they fit between each other's files and units can pass through one another as in Total War. A marching unit has right of way over an idle one (between two marching units, the lower unit id wins): the other soldier steps sideways off its path instead of being shoved ahead, and the marching soldier is not pushed at all.
## Soldier model

Shallot has no skinning or glTF loader, so the rig is baked: `trooper.glb` holds static meshes `idle` and `run_00`…`run_NN` (Y up, facing +Z, feet at origin), plus the same set prefixed `lod_` from the low-detail `Trooper_LOD` mesh, all sharing one embedded palette PNG that UVs point into. `animateSoldiers` swaps each soldier's `MeshInstance.mesh` by run phase, advanced by distance moved over `RUN_CYCLE_LENGTH`, using the `lod_` frames beyond `SOLDIER_LOD_DISTANCE` from the camera. To change the model, edit it in Blender and run `export_trooper.py`; `src/scene/gltf.ts` only reads unstrided float POSITION/NORMAL/TEXCOORD_0 with one primitive per mesh.

## Shallot rules

- Import from `@dylanebert/shallot` and its subpaths: `/extras` (`Orbit`, `LinesPlugin`, `drawLine`), `/rendering` (`viewportToWorld`, `worldToViewport`), `/standard/rendering`.
- Read `Devices` only in `"setup"` or `"simulation"` systems, never `"fixed"`. Hand input to fixed systems through components.
- Plugin state goes in `world.resource(...)`, never module globals. Plugins with `"fixed"` systems declare `recovery`.
- `Transform` is the only source of soldier position and heading. Don't spawn per-frame entities for markers: use immediate `drawLine`.
- `StandardMaterial` colors are linear (`src/scene/color.ts`); `Camera.clearColor` and `drawLine` colors are sRGB hex.
- `worldToViewport`/`viewportToWorld` use CSS pixels, matching pointer offsets.
- The world is right-handed, Y up. Heading `h` faces `(sin h, cos h)`; formation right is `forward × up`, i.e. `(-cos h, sin h)`.
- When unsure about an API, check the JSDoc in `node_modules/@dylanebert/shallot/src` and its `examples/`.
