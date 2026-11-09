# Soldier model

Shallot has no skinning or glTF loader, so the rig is baked into static meshes. Each unit type has its own model, named by `model` in `UNIT_TYPES`.

## Source

Each unit type has a `.blend` in `assets/` holding the mesh, the rig, the `Run` action and two text blocks:

| Unit type | Source                   | Scripts                                    | Output                        |
| --------- | ------------------------ | ------------------------------------------ | ----------------------------- |
| Trooper   | `assets/trooper.blend`   | `build_trooper.py`, `export_trooper.py`    | `public/models/trooper.glb`   |
| Vanguard  | `assets/vanguard.blend`  | `build_vanguard.py`, `export_vanguard.py`  | `public/models/vanguard.glb`  |

- `build_<type>.py` rebuilds the mesh, the rig and the palette.
- `export_<type>.py` bakes the frames and writes the GLB.

To change a model, edit it in Blender and run its export script. All rigs share the trooper's joints and bone names, so a new unit type can copy the `Run` action from `trooper.blend`.

## GLB layout

- Static meshes `idle` and `run_00`…`run_NN`: Y up, facing +Z, feet at the origin.
- The same set prefixed `lod_`, baked from the low-detail `<Type>_LOD` mesh.
- Optionally the same set prefixed `fx_`, baked from `<Type>_FX`: glowing parts (the Vanguard's holo shield, blade aura and lightning arcs). The game draws these unlit and additively, so their palette colors set how much light they add.
- All meshes share one embedded palette PNG that their UVs point into.
- `src/scene/gltf.ts` only reads unstrided float POSITION/NORMAL/TEXCOORD_0 with one primitive per mesh.

The Vanguard's lightning arcs move between run frames: a geometry nodes modifier (`Arcs`) offsets each arc by a random amount seeded by the frame number, so the baked frames flicker.

## Runtime

Each soldier's `MeshInstance.mesh` is swapped by run phase, which advances by distance moved over `RUN_CYCLE_LENGTH`. Beyond `SOLDIER_LOD_DISTANCE` from the camera the `lod_` frames are used (LOD, level of detail: a cheaper mesh for far-away objects).

A model with `fx_` frames gives each soldier a second glow entity that follows the soldier and shows the matching `fx_` frame. It has no LOD version, so the glow stays visible at any distance.
