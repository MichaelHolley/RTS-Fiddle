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
- `src/units/` – components, unit spawning/movement/separation/run animation, formation planning and slot math
- `src/input/` – selection, control groups, move commands, ground picking
- `src/scene/` – world setup, mesh helpers, GLB loader, color conversion
- `src/ui/` – world-space line markers and DOM HUD/selection box
- `assets/trooper.blend` – trooper source: mesh, rig, `Run` action, and the text blocks `build_trooper.py` (rebuilds mesh + rig + palette) and `export_trooper.py` (bakes frames, writes the GLB)
- `public/models/trooper.glb` – exported unit model

## Unit model

Shallot has no skinning or glTF loader, so the rig is baked: `trooper.glb` holds static meshes `idle` and `run_00`…`run_NN` (Y up, facing +Z, feet at origin) sharing one embedded palette PNG that UVs point into. `animateUnits` swaps each unit's `MeshInstance.mesh` by run phase, advanced by distance moved over `RUN_CYCLE_LENGTH`. To change the model, edit it in Blender and run `export_trooper.py`; `src/scene/gltf.ts` only reads unstrided float POSITION/NORMAL/TEXCOORD_0 with one primitive per mesh.

## Shallot rules

- Import from `@dylanebert/shallot` and its subpaths: `/extras` (`Orbit`, `LinesPlugin`, `drawLine`), `/rendering` (`viewportToWorld`, `worldToViewport`), `/standard/rendering`.
- Read `Devices` only in `"setup"` or `"simulation"` systems, never `"fixed"`. Hand input to fixed systems through components.
- Plugin state goes in `world.resource(...)`, never module globals. Plugins with `"fixed"` systems declare `recovery`.
- Units are entities; `Transform` is the only source of position and heading. Don't spawn per-frame entities for markers: use immediate `drawLine`.
- `StandardMaterial` colors are linear (`src/scene/color.ts`); `Camera.clearColor` and `drawLine` colors are sRGB hex.
- `worldToViewport`/`viewportToWorld` use CSS pixels, matching pointer offsets.
- The world is right-handed, Y up. Heading `h` faces `(sin h, cos h)`; formation right is `forward × up`, i.e. `(-cos h, sin h)`.
- When unsure about an API, check the JSDoc in `node_modules/@dylanebert/shallot/src` and its `examples/`.
