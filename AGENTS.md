# AGENTS.md

Browser 3D RTS prototype: Vite + TypeScript + Shallot (WebGPU ECS engine), Bun. Placeholder meshes only, no external assets.

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
- `src/units/` – components, unit spawning/movement/separation, formation planning and slot math
- `src/input/` – selection, control groups, move commands, ground picking
- `src/scene/` – world setup, mesh helpers, color conversion
- `src/ui/` – world-space line markers and DOM HUD/selection box

## Shallot rules

- Import from `@dylanebert/shallot` and its subpaths: `/extras` (`Orbit`, `LinesPlugin`, `drawLine`), `/rendering` (`viewportToWorld`, `worldToViewport`), `/standard/rendering`.
- Read `Devices` only in `"setup"` or `"simulation"` systems, never `"fixed"`. Hand input to fixed systems through components.
- Plugin state goes in `world.resource(...)`, never module globals. Plugins with `"fixed"` systems declare `recovery`.
- Units are entities; `Transform` is the only source of position and heading. Don't spawn per-frame entities for markers: use immediate `drawLine`.
- `StandardMaterial` colors are linear (`src/scene/color.ts`); `Camera.clearColor` and `drawLine` colors are sRGB hex.
- `worldToViewport`/`viewportToWorld` use CSS pixels, matching pointer offsets.
- The world is right-handed, Y up. Heading `h` faces `(sin h, cos h)`; formation right is `forward × up`, i.e. `(-cos h, sin h)`.
- When unsure about an API, check the JSDoc in `node_modules/@dylanebert/shallot/src` and its `examples/`.
