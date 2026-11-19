import { ImageFilterMode, Materials, Meshes, MeshInstance, MeshMaterial, registerImage, StandardMaterial, Transform } from '@dylanebert/shallot'
import type { ImageLoaderSettings, Plugin, World } from '@dylanebert/shallot'
import { PROP_TYPES } from '../config'
import { Terrain, terrainHeight } from './heightmap'
import type { Heightmap } from './heightmap'
import { Obstacles } from './obstacles'
import { PROP_PALETTE, propMeshes } from './propMeshes'
import { groundColors, terrainGeometry } from './terrainMesh'

const NEAREST = ImageFilterMode.Nearest

async function registerPixels(world: World, pixels: ImageData, settings?: ImageLoaderSettings): Promise<number> {
  const canvas = new OffscreenCanvas(pixels.width, pixels.height)
  canvas.getContext('2d')!.putImageData(pixels, 0, 0)
  return registerImage(world, await canvas.convertToBlob(), settings)
}

// The lowest ground under the footprint, so props on a slope don't float on their downhill side.
function groundUnder(map: Heightmap, x: number, z: number, radius: number): number {
  return Math.min(
    terrainHeight(map, x, z),
    terrainHeight(map, x + radius, z),
    terrainHeight(map, x - radius, z),
    terrainHeight(map, x, z + radius),
    terrainHeight(map, x, z - radius),
  )
}

function palettePixels(): ImageData {
  const canvas = new OffscreenCanvas(PROP_PALETTE.length, 1)
  const context = canvas.getContext('2d')!
  PROP_PALETTE.forEach((color, i) => {
    context.fillStyle = color
    context.fillRect(i, 0, 1, 1)
  })
  return context.getImageData(0, 0, PROP_PALETTE.length, 1)
}

async function spawnGround(world: World): Promise<void> {
  const map = world.resource(Terrain)
  const texture = await registerPixels(world, groundColors(map))
  const ground = world.create()
  world.add(ground, Transform)
  world.add(ground, MeshInstance, { mesh: world.resource(Meshes).add({ name: 'terrain', ...terrainGeometry(map) }) })
  world.add(
    ground,
    MeshMaterial,
    world.resource(Materials).add(StandardMaterial({ baseColorTexture: texture, perceptualRoughness: 0.95 })),
  )
}

async function spawnProps(world: World): Promise<void> {
  const map = world.resource(Terrain)
  const palette = await registerPixels(world, palettePixels(), {
    sampler: { magFilter: NEAREST, minFilter: NEAREST, mipmapFilter: NEAREST },
  })
  const material = world.resource(Materials).add(StandardMaterial({ baseColorTexture: palette, perceptualRoughness: 0.85 }))
  const registry = world.resource(Meshes)
  const shapes = propMeshes()
  const meshes = PROP_TYPES.map((type) =>
    shapes[type.shape].map((geometry, i) => registry.add({ name: `${type.name} ${i}`, ...geometry })),
  )
  world.resource(Obstacles).list.forEach((obstacle, i) => {
    const variants = meshes[obstacle.type]
    const { x, z, radius, yaw } = obstacle
    const prop = world.create()
    world.add(prop, Transform, {
      translation: [x, groundUnder(map, x, z, radius), z],
      rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      scale: [radius, radius, radius],
    })
    world.add(prop, MeshInstance, { mesh: variants[i % variants.length] })
    world.add(prop, MeshMaterial, material)
  })
}

/** The procedural map: heightmap ground and scattered obstacles, both from the map seed. */
export const TerrainPlugin: Plugin = {
  name: 'RtsTerrain',
  async initialize(world) {
    await Promise.all([spawnGround(world), spawnProps(world)])
  },
}
