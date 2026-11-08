# AGENTS.md

Browser 3D RTS prototype: Vite + TypeScript + Shallot (WebGPU ECS engine), Bun. Props are placeholder meshes; units use the Blender-made trooper model.

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
- `src/config.ts` – all tuning constants
- `src/camera/` – RTS camera (drives `Orbit` in Manual mode)
- `src/units/` – components, army spawning, unit marching, soldier movement/separation/run animation, order planning (right-click move, right-drag frontage) and slot math
- `src/input/` – unit selection, control groups, move orders, ground picking
- `src/scene/` – world setup, mesh helpers, GLB loader, color conversion
- `src/ui/` – world-space line markers and DOM HUD/selection box
- `assets/trooper.blend` – trooper source: mesh, rig, `Run` action, and the text blocks `build_trooper.py` (rebuilds mesh + rig + palette) and `export_trooper.py` (bakes frames, writes the GLB)
- `public/models/trooper.glb` – exported unit model

## Units and soldiers

Terms follow Total War. A **unit** is the selectable block (`Unit` entity: center, destination, facing, files × ranks); a **soldier** is one trooper (`Soldier` entity: owning unit plus a fixed slot in the unit's formation). **Files** are columns and **ranks** are rows; the front rank's width is the **frontage**. "Group" is reserved for Total War's Ctrl+G grouping of several units. Selection, control groups and orders work on units, never single soldiers. Right-click moves the selection keeping its shape and turns it toward the direction of travel; right-drag sets the frontage line, split between units by soldier count, facing perpendicular to the drag.

## Soldier model

Shallot has no skinning or glTF loader, so the rig is baked: `trooper.glb` holds static meshes `idle` and `run_00`…`run_NN` (Y up, facing +Z, feet at origin) sharing one embedded palette PNG that UVs point into. `animateSoldiers` swaps each soldier's `MeshInstance.mesh` by run phase, advanced by distance moved over `RUN_CYCLE_LENGTH`. To change the model, edit it in Blender and run `export_trooper.py`; `src/scene/gltf.ts` only reads unstrided float POSITION/NORMAL/TEXCOORD_0 with one primitive per mesh.

## Shallot rules

- Import from `@dylanebert/shallot` and its subpaths: `/extras` (`Orbit`, `LinesPlugin`, `drawLine`), `/rendering` (`viewportToWorld`, `worldToViewport`), `/standard/rendering`.
- Read `Devices` only in `"setup"` or `"simulation"` systems, never `"fixed"`. Hand input to fixed systems through components.
- Plugin state goes in `world.resource(...)`, never module globals. Plugins with `"fixed"` systems declare `recovery`.
- `Transform` is the only source of soldier position and heading. Don't spawn per-frame entities for markers: use immediate `drawLine`.
- `StandardMaterial` colors are linear (`src/scene/color.ts`); `Camera.clearColor` and `drawLine` colors are sRGB hex.
- `worldToViewport`/`viewportToWorld` use CSS pixels, matching pointer offsets.
- The world is right-handed, Y up. Heading `h` faces `(sin h, cos h)`; formation right is `forward × up`, i.e. `(-cos h, sin h)`.
- When unsure about an API, check the JSDoc in `node_modules/@dylanebert/shallot/src` and its `examples/`.
