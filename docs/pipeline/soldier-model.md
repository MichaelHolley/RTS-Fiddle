# Soldier model

Shallot has no skinning or glTF loader, so the rig is baked into static meshes.

## Source

`assets/trooper.blend` holds the mesh, the rig, the `Run` action and two text blocks:

- `build_trooper.py` rebuilds the mesh, the rig and the palette.
- `export_trooper.py` bakes the frames and writes `public/models/trooper.glb`.

To change the model, edit it in Blender and run `export_trooper.py`.

## GLB layout

- Static meshes `idle` and `run_00`…`run_NN`: Y up, facing +Z, feet at the origin.
- The same set prefixed `lod_`, baked from the low-detail `Trooper_LOD` mesh.
- All meshes share one embedded palette PNG that their UVs point into.
- `src/scene/gltf.ts` only reads unstrided float POSITION/NORMAL/TEXCOORD_0 with one primitive per mesh.

## Runtime

Each soldier's `MeshInstance.mesh` is swapped by run phase, which advances by distance moved over `RUN_CYCLE_LENGTH`. Beyond `SOLDIER_LOD_DISTANCE` from the camera the `lod_` frames are used (LOD, level of detail: a cheaper mesh for far-away objects).
