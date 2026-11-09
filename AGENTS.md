# AGENTS.md

Browser 3D RTS prototype: Vite + TypeScript + Shallot (WebGPU ECS engine), Bun.

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

## Docs

- Game design lives in `docs/design/`, one file per mechanic; asset pipelines live in `docs/pipeline/`. Read the relevant file before changing a mechanic or asset, and update it in the same commit. A new mechanic gets its own file.
- Docs describe player-visible behaviour and why. How it is computed belongs in the code, as a JSDoc or `//` comment on the system.
- Docs refer to constants by name (`UNIT_SPEED`), never by value.
- Use the terms in `docs/design/units.md` (unit, soldier, files, ranks, frontage, group) in code, UI and docs.

## Total War reference

Controls, terms and mechanics copy Total War (Warhammer / Three Kingdoms era). When adding or changing a mechanic, match how Total War does it unless told otherwise. Call out any deliberate deviation and list it in `docs/design/total-war.md`.

## File composition

- One concern per file: a file owns one system (or a tight `after:` chain of them) plus the resources, constants and helpers only it uses. When a file's name no longer describes everything in it, split it. New per-soldier behaviour (combat, morale) gets its own file and `System`, ordered with `after:` against the existing chain.
- Keep a helper or constant in the file that uses it; move it to a shared module once a second file needs it.
- `src/config.ts` is the only home of tuning values, data tables (e.g. unit types) and key bindings. Adding a variant of something (a unit type, an army entry) means adding a table entry, not code paths.
- Each file declares its own query arrays (`const SOLDIERS = [Soldier]`); repeating these one-liners across files is intended.
- Imports form a one-way graph: a plugin file (e.g. `units.ts`) imports its systems, and a system file imports components, `formation.ts`, `config.ts`, shared helpers and the systems it runs `after`, never its plugin file. A cycle breaks `after:` references at startup. New plugins are registered as dependencies of `RtsPlugin` in `src/app.ts`.

## Keyboard input

- Every game key binding is a `KEYS` entry in `src/config.ts`: a list of `KeyboardEvent.code` values. Read it with `anyKey` from `src/input/keys.ts`: `anyKey(keys.pressed, KEYS.x)` for one-shot actions, `anyKey(keys.held, KEYS.x)` for continuous ones. Key-code strings live only in `KEYS`, apart from the browser's own keys in `src/input/browserShortcuts.ts`.
- Check `KEYS` for clashes before adding a binding. Ctrl+letter is reserved for commands, so systems reading plain-letter keys skip them while Ctrl is held.
- Never bind Ctrl+W/T/N/Tab: no page can block them.

## Assets

- Never hand-edit exported files in `public/`. Change the source in `assets/` and re-export, as described in `docs/pipeline/`.

## Shallot rules

- Import from `@dylanebert/shallot` and its subpaths: `/extras` (`Orbit`, `LinesPlugin`, `drawLine`), `/rendering` (`viewportToWorld`, `worldToViewport`), `/standard/rendering`.
- Read `Devices` only in `"setup"` or `"simulation"` systems, never `"fixed"`. Hand input to fixed systems through components.
- Plugin state goes in `world.resource(...)`, never module globals. Plugins with `"fixed"` systems declare `recovery`.
- `Transform` is the only source of entity position and heading. Don't spawn per-frame entities for markers: use immediate `drawLine`.
- `StandardMaterial` colors are linear (`src/scene/color.ts`); `Camera.clearColor` and `drawLine` colors are sRGB hex.
- `worldToViewport`/`viewportToWorld` use CSS pixels, matching pointer offsets.
- The world is right-handed, Y up. Heading `h` faces `(sin h, cos h)`; formation right is `forward × up`, i.e. `(-cos h, sin h)`.
- When unsure about an API, check the JSDoc in `node_modules/@dylanebert/shallot/src` and its `examples/`.
