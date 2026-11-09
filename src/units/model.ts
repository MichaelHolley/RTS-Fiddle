import { ImageFilterMode, Materials, Meshes, registerImage, StandardMaterial, Transform } from '@dylanebert/shallot'
import type { MeshHandle, Resource, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import { SOLDIER_LOD_DISTANCE, SOLDIER_MODEL_URL } from '../config'
import { loadGlb } from '../scene/gltf'
import { RtsView } from '../scene/world'

const LOD_DISTANCE_SQ = SOLDIER_LOD_DISTANCE * SOLDIER_LOD_DISTANCE

interface SoldierFrames {
  idle: MeshHandle
  run: MeshHandle[]
}

export const SoldierModel: Resource<{ detail: SoldierFrames; lod: SoldierFrames; palette: number }> = {
  create: () => ({
    detail: { idle: 0 as MeshHandle, run: [] },
    lod: { idle: 0 as MeshHandle, run: [] },
    palette: -1,
  }),
}

export const soldierMaterial =
  (baseColor?: readonly [number, number, number, number]): Resource<MaterialHandle>['create'] =>
  (world) =>
    world.resource(Materials).add(
      StandardMaterial({
        baseColor,
        baseColorTexture: world.resource(SoldierModel).palette,
        perceptualRoughness: 0.6,
      }),
    )

export const SoldierMaterial: Resource<MaterialHandle> = { create: soldierMaterial() }

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

export async function loadSoldierModel(world: World): Promise<void> {
  const { meshes, images } = await loadGlb(SOLDIER_MODEL_URL)
  const registry = world.resource(Meshes)
  const add = (name: string): MeshHandle => {
    const geometry = meshes.get(name)
    if (!geometry) throw new Error(`${SOLDIER_MODEL_URL} has no mesh "${name}"`)
    return registry.add({ name: `trooper ${name}`, ...geometry })
  }
  const frames = (prefix: string): SoldierFrames => ({
    idle: add(`${prefix}idle`),
    run: [...meshes.keys()].filter((name) => name.startsWith(`${prefix}run_`)).sort().map(add),
  })
  const model = world.resource(SoldierModel)
  model.detail = frames('')
  model.lod = frames('lod_')
  const nearest = ImageFilterMode.Nearest
  model.palette = registerImage(world, images[0], {
    sampler: { magFilter: nearest, minFilter: nearest, mipmapFilter: nearest },
  })
}
