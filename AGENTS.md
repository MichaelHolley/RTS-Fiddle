# AGENTS.md

Browser 3D RTS prototype: Vite + TypeScript + Babylon.js 9. Placeholder meshes only, no external assets.

## Commands

- `npm run dev` – dev server (port 5173). Assume the user may already be running it.
- `npm run typecheck` – verify every change with this.
- `npm run build` – the chunk-size warning is expected (the Babylon barrel import isn't tree-shaken).

Package manager is npm.

## Workflow

This is a vibe-coded MVP:

- No tests are required. Typecheck and build are enough.
- Commit directly to `main`; no feature branches or PRs needed. Use conventional commit messages.

## Structure

- `src/main.ts` – bootstrap and wiring
- `src/config.ts` – all tuning constants
- `src/camera/` – RTS camera
- `src/units/` – units and thin-instance rendering
- `src/input/` – selection, move commands, formations
- `src/scene/` – world setup
- `src/ui/` – DOM overlays and markers

`PLAN.md` holds the original design and post-MVP ideas.

## Conventions

- Keep it simple: no ECS, state library or UI framework.
- Style: no semicolons, single quotes, 2-space indent. Event listeners are arrow-function class fields.
- `verbatimModuleSyntax`, `noUnusedLocals` and `noUnusedParameters` are on. Use `import type` for type-only imports.
- Don't allocate in per-frame loops. Reuse temporary vectors and matrices.
- Put tuning values in `config.ts`.

## Babylon gotchas

- Import from the `@babylonjs/core` barrel, not deep paths.
- Never call `camera.attachControl`. All input is handled manually.
- All troops are a single mesh drawn with thin instances. Update their buffers, never create a mesh per unit.
- `Vector3.ProjectToRef` returns render pixels; convert them to CSS pixels before comparing with pointer offsets. `scene.pick` takes CSS offsets directly.
- `*ToRef` methods don't always return the ref (e.g. `Viewport.toGlobalToRef` returns `this`). Use the ref you passed in.
- When unsure about an API, check the typings and source in `node_modules/@babylonjs/core`.
