# RTS MVP – Implementation Plan

A browser-based 3D RTS prototype: command 100+ placeholder troops on a flat battlefield with an RTS camera, rectangle selection (left mouse) and move orders (right mouse).

This document is the hand-off for an implementing agent. Work through the milestones in order; each has acceptance criteria to check before moving on.

## Ground rules

- **Placeholders only**: primitive meshes and flat colors, no external assets.
- **No tests.** Verify with `npm run typecheck`, `npm run build`, and manual checks in the browser.
- Keep it simple (YAGNI). No ECS, no state library, no UI framework.
- Do not start a dev server unless needed; the user may already run one (`npm run dev`, port 5173).
- Package manager: **npm**.

## Current state (already done)

- Vite 8 + TypeScript 6 (`vanilla-ts` template) scaffolded, template boilerplate removed.
- Installed: `@babylonjs/core@^9` (dep), `@babylonjs/inspector@^9` (devDep, its peer packages were auto-installed).
- `index.html` contains `<canvas id="game">`, `<div id="selection-box">`, `<div id="hud">`.
- `src/style.css` styles all three (full-screen canvas, absolutely positioned overlay box and HUD).
- `src/main.ts` only imports the stylesheet.
- Scripts: `dev`, `build` (`tsc && vite build`), `preview`, `typecheck` (`tsc`, `noEmit` is set).

## Babylon 9 notes

- Import from the barrel: `import { Engine, Scene, ... } from '@babylonjs/core'`. Babylon 9 ships `*.pure` side-effect-free modules; deep imports can silently miss prototype augmentations (e.g. thin instance methods on `Mesh`). The barrel avoids that. Tree-shaking is not a concern for the MVP.
- Inspector (dev only, lazy): `if (import.meta.env.DEV)` → on F9 `const { ShowInspector } = await import('@babylonjs/inspector'); ShowInspector(scene)`. (`scene.debugLayer` is the legacy path; prefer `ShowInspector`.)
- `tsconfig` has `verbatimModuleSyntax`: use `import type` for type-only imports.
- `noUnusedLocals` / `noUnusedParameters` are on.

## Target file structure

```
src/
  main.ts                       engine + scene bootstrap, wiring, render loop, resize
  config.ts                     all tuning constants
  scene/createWorld.ts          light, ground, placeholder props; returns the ground mesh
  camera/RtsCamera.ts           ArcRotateCamera driven by own input
  units/Unit.ts                 Unit type
  units/UnitManager.ts          spawn, thin-instance buffers, movement, selection state
  input/SelectionController.ts  left-drag rectangle + click select
  input/CommandController.ts    right-click → move order
  input/formation.ts            grid slot generation
  ui/SelectionBox.ts            controls the #selection-box overlay
  ui/MoveMarker.ts              placeholder ring that pulses at the order point
  ui/Hud.ts                     FPS + selected count in #hud
```

## `config.ts`

Single source for tuning values, e.g.:

```ts
export const UNIT_COUNT = 100
export const UNIT_SPEED = 6
export const UNIT_RADIUS = 0.5
export const FORMATION_SPACING = 1.5
export const MAP_SIZE = 200
export const CAMERA = {
  minRadius: 10,
  maxRadius: 120,
  beta: 0.9,
  panSpeed: 1.2,
  rotateSpeed: 2,
  edgePanPx: 12,
}
export const DRAG_THRESHOLD_PX = 4
export const CLICK_SELECT_RADIUS_PX = 20
```

## Milestones

### M1 – Bootstrap and world

`main.ts`
- `new Engine(canvas, true)`, `new Scene(engine)`, set a dark clear color.
- `engine.runRenderLoop(() => scene.render())`, `window.addEventListener('resize', () => engine.resize())`.
- `canvas.addEventListener('contextmenu', e => e.preventDefault())`.
- F9 inspector toggle as described above.

`scene/createWorld.ts`
- `HemisphericLight` (and optionally one `DirectionalLight` for shading).
- `MeshBuilder.CreateGround('ground', { width: MAP_SIZE, height: MAP_SIZE })` with a `StandardMaterial` (muted green). A grid look is optional (`GridMaterial` would need `@babylonjs/materials`, which is already installed as an inspector peer; add it to `dependencies` if used).
- ~20 randomly placed boxes/cylinders in neutral colors as landmarks (`isPickable = false`).
- Return the ground mesh; it is the only pickable mesh used for commands.

**Done when:** `npm run dev` shows a lit ground with props (temporarily use a fixed camera until M2).

### M2 – RTS camera

`camera/RtsCamera.ts` wraps an `ArcRotateCamera`.
- **Never call `attachControl`.** Its default left-drag rotation conflicts with selection. All input is handled manually.
- Keyboard state set from `keydown`/`keyup` on `window` (track by `e.code`).
- **Pan:** WASD / arrow keys and mouse within `edgePanPx` of the canvas edge. Compute forward = `target - position` flattened to XZ and normalized; right = cross(up, forward) (check sign). Move `camera.target` by `(dir) * panSpeed * radius * dt`.
- **Zoom:** `wheel` on canvas → `radius *= 1 + sign(deltaY) * 0.1`, clamp to `[minRadius, maxRadius]`. `preventDefault` on the event (listener with `{ passive: false }`).
- **Rotate:** Q/E adjust `alpha` by `rotateSpeed * dt`. Middle-mouse drag (`button === 1`) adjusts `alpha` by `movementX * 0.005`.
- `beta` stays fixed at `CAMERA.beta`.
- Clamp `target.x/z` to `±MAP_SIZE/2`, keep `target.y = 0`.
- Update in `scene.onBeforeRenderObservable` using `scene.getEngine().getDeltaTime() / 1000`.
- Set `scene.activeCamera` to this camera.

**Done when:** pan, zoom, rotate all work, feel consistent at every zoom level, and the camera cannot leave the map.

### M3 – 100 troops with thin instances

`units/Unit.ts`
```ts
export interface Unit {
  id: number
  position: Vector3
  target: Vector3 | null
  heading: number
  selected: boolean
}
```

`units/UnitManager.ts`
- One base mesh: `MeshBuilder.CreateCapsule('unit', { radius: 0.3, height: 1.8 })`, `StandardMaterial` with white diffuse (so the per-instance color shows through), `isPickable = false`. Optionally add a small box "nose" merged into the mesh (`Mesh.MergeMeshes`) so facing direction is visible.
- Spawn `UNIT_COUNT` units in a grid around the origin.
- Buffers:
  - `matrices = new Float32Array(n * 16)`, `colors = new Float32Array(n * 4)`.
  - `mesh.thinInstanceSetBuffer('matrix', matrices, 16, false)` and `mesh.thinInstanceSetBuffer('color', colors, 4, false)`.
- Per frame (`update(dt)`):
  - For each unit with a target: move towards it by `UNIT_SPEED * dt`; when within `0.1`, snap and clear target. Update `heading = atan2(dx, dz)` while moving.
  - **Separation:** for every pair closer than `2 * UNIT_RADIUS`, push both apart by half the overlap along the XZ delta. O(n²) is fine up to ~500 units.
  - Write each matrix with `Matrix.ComposeToRef(scale, Quaternion.FromEulerAngles(0, heading, 0), position, tmpMatrix)` then `tmpMatrix.copyToArray(matrices, i * 16)`. Reuse temporaries; no allocations in the loop.
  - `mesh.thinInstanceBufferUpdated('matrix')`.
- Y position = half capsule height so troops stand on the ground.
- Public API used by controllers: `units` (readonly array), `setSelection(ids: Iterable<number>, additive: boolean)`, `clearSelection()`, `selected()`, `issueMove(assignments: Map<number, Vector3>)`.
- Any selection change rewrites the affected color entries (idle `#dddddd`, selected `#44ff66`) and calls `thinInstanceBufferUpdated('color')`.

**Done when:** 100 troops render; the inspector's statistics show one draw call for all troops; stable 60 fps.

### M4 – Rectangle and click selection

`ui/SelectionBox.ts`: `show(x0, y0, x1, y1)` sets left/top/width/height from min/abs of the corners and `display: block`; `hide()`.

`input/SelectionController.ts`
- Use canvas `pointerdown` / `pointermove` / `pointerup` with `button === 0`; call `canvas.setPointerCapture(e.pointerId)` on down.
- Track start (`offsetX/offsetY`) and current position. Show the box once the drag exceeds `DRAG_THRESHOLD_PX`.
- On release:
  - **Drag:** project each unit to screen and select those inside the rectangle.
  - **Click:** select the unit with the smallest screen distance within `CLICK_SELECT_RADIUS_PX`; if none, clear the selection.
  - **Shift held:** additive (union with current selection) instead of replace.
- Projection:
  ```ts
  const w = engine.getRenderWidth()
  const h = engine.getRenderHeight()
  const viewport = camera.viewport.toGlobal(w, h)
  const transform = scene.getTransformMatrix()
  Vector3.ProjectToRef(unit.position, Matrix.IdentityReadOnly, transform, viewport, out)
  ```
  The result is in render pixels with a top-left origin. Convert to CSS pixels by multiplying with `canvas.clientWidth / w` (and the height equivalent) before comparing to pointer offsets; this matters on hi-DPI screens or if hardware scaling is changed. Skip units with `out.z` outside `[0, 1]` (behind the camera).
- Ignore events while the middle mouse button is used for camera rotation.

**Done when:** drag-select, click-select, click-empty-to-clear and shift-add all work and selected troops are highlighted.

### M5 – Move orders

`input/formation.ts`
- `gridSlots(center: Vector3, count: number, facing: number, spacing = FORMATION_SPACING): Vector3[]`
- `cols = ceil(sqrt(count))`, rows accordingly; slots are centered on `center`, rotated by `facing` (yaw) around Y.

`input/CommandController.ts`
- On canvas `pointerdown` with `button === 2` and a non-empty selection:
  - `const pick = scene.pick(e.offsetX, e.offsetY, m => m === ground)`; bail if no hit.
  - `facing = atan2` of the vector from the selection centroid to the picked point.
  - Generate slots, then assign: sort selected units and slots by their projection onto the axis perpendicular to `facing` (secondary: along `facing`) and zip. Keeps paths from crossing too much without needing an optimal assignment.
  - `unitManager.issueMove(assignments)` and `moveMarker.play(pick.pickedPoint)`.

`ui/MoveMarker.ts`
- One reusable `CreateTorus` (thin, flat, bright color, `isPickable = false`).
- `play(point)`: position slightly above the ground, scale from 0.5 → 1.5 and alpha 1 → 0 over ~0.5 s via `onBeforeRenderObservable`, then hide.

**Done when:** right-clicking the ground sends the selected troops into a grid formation facing the move direction, the marker appears, troops don't stack on top of each other.

### M6 – HUD and stress check

`ui/Hud.ts`: every 250 ms write `FPS: ${engine.getFps().toFixed(0)} | Units: n | Selected: k` into `#hud`.

Stress check: set `UNIT_COUNT = 500`, confirm it remains smooth (separation is the expected hotspot). If it isn't, add a uniform spatial hash grid (cell size = `2 * UNIT_RADIUS`) for the separation step. Reset `UNIT_COUNT` to 100 afterwards.

**Done when:** HUD shows live numbers; 500 units run smoothly.

## Final verification

1. `npm run typecheck`: no errors.
2. `npm run build`: succeeds.
3. Manual browser check: every milestone's "Done when" item, plus:
   - Browser context menu never appears on right-click.
   - Dragging the selection box over the window edge and releasing outside still ends the selection (pointer capture).
   - Resize the window: rendering and selection projection stay correct.

## Out of scope (post-MVP ideas)

- Terrain with heightmap sampling for unit Y.
- Pathfinding / obstacle avoidance (flow field or Recast navmesh via `RecastJSPlugin`).
- Combat, enemy factions, AI.
- Real models with baked vertex animation textures (compatible with thin instances).
- Control groups (Ctrl+1..9), double-click select-all-of-type, attack-move.
