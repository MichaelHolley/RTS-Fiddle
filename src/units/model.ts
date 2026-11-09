import { ImageFilterMode, Materials, Meshes, registerImage, StandardMaterial, Transform } from '@dylanebert/shallot'
import type { MeshHandle, Resource, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import { SOLDIER_LOD_DISTANCE, UNIT_TYPES, UnitTypeId } from '../config'
import type { UnitType } from '../config'
import { loadGlb } from '../scene/gltf'
import { RtsView } from '../scene/world'

const LOD_DISTANCE_SQ = SOLDIER_LOD_DISTANCE * SOLDIER_LOD_DISTANCE

export interface SoldierFrames {
  idle: MeshHandle
  run: MeshHandle[]
}

/** The `fx_` frames of a model's glowing parts, drawn on a second entity per soldier. */
export interface GlowModel {
  frames: SoldierFrames
  material: MaterialHandle
}

/** One unit type's soldier meshes. */
export interface SoldierModel {
  detail: SoldierFrames
  lod: SoldierFrames
  glow: GlowModel | undefined
  palette: number
  material: MaterialHandle
}

/** Indexed by `UnitTypeId`. */
export const SoldierModels: Resource<SoldierModel[]> = { create: () => [] }

export function soldierMaterial(
  world: World,
  palette: number,
  baseColor?: readonly [number, number, number, number],
): MaterialHandle {
  return world
    .resource(Materials)
    .add(StandardMaterial({ baseColor, baseColorTexture: palette, perceptualRoughness: 0.6 }))
}

// Additive and unlit so the glow brightens whatever is behind it and stays bright in shadow.
function glowMaterial(world: World, palette: number): MaterialHandle {
  return world
    .resource(Materials)
    .add(StandardMaterial({ baseColorTexture: palette, unlit: true }), { alphaMode: { kind: 'add' }, cullMode: 'none' })
}

interface Point3 {
  x: number
  y: number
  z: number
}

export function cameraPosition(world: World): Point3 {
  const { translation } = world.storage(Transform)
  const camera = world.resource(RtsView).camera
  return { x: translation.x.get(camera), y: translation.y.get(camera), z: translation.z.get(camera) }
}

export function usesLod(camera: Point3, x: number, z: number): boolean {
  return (x - camera.x) ** 2 + camera.y ** 2 + (z - camera.z) ** 2 > LOD_DISTANCE_SQ
}

async function loadSoldierModel(world: World, type: UnitType): Promise<SoldierModel> {
  const { meshes, images } = await loadGlb(type.model)
  const registry = world.resource(Meshes)
  const add = (name: string): MeshHandle => {
    const geometry = meshes.get(name)
    if (!geometry) throw new Error(`${type.model} has no mesh "${name}"`)
    return registry.add({ name: `${type.name} ${name}`, ...geometry })
  }
  const frames = (prefix: string): SoldierFrames => ({
    idle: add(`${prefix}idle`),
    run: [...meshes.keys()].filter((name) => name.startsWith(`${prefix}run_`)).sort().map(add),
  })
  const nearest = ImageFilterMode.Nearest
  const palette = registerImage(world, images[0], {
    sampler: { magFilter: nearest, minFilter: nearest, mipmapFilter: nearest },
  })
  return {
    detail: frames(''),
    lod: frames('lod_'),
    glow: meshes.has('fx_idle') ? { frames: frames('fx_'), material: glowMaterial(world, palette) } : undefined,
    palette,
    material: soldierMaterial(world, palette),
  }
}

export async function loadSoldierModels(world: World): Promise<void> {
  const models = world.resource(SoldierModels)
  await Promise.all(
    Object.values(UnitTypeId).map(async (id) => {
      models[id] = await loadSoldierModel(world, UNIT_TYPES[id])
    }),
  )
}
