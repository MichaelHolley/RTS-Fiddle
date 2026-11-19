import type { World } from '@dylanebert/shallot'
import { viewportToWorld } from '@dylanebert/shallot/rendering'
import { MAP_SIZE, TERRAIN } from '../config'
import { RtsView } from '../scene/world'
import { Terrain, terrainHeight } from '../terrain/heightmap'
import type { Point } from '../units/formation'

const HALF_MAP = MAP_SIZE / 2
const MARCH_STEP = TERRAIN.cellSize / 2
const REFINE_STEPS = 8

/** Where the pointer ray first hits the terrain, found by stepping along the ray between the highest and lowest ground. */
export function pickGround(world: World, x: number, y: number): Point | null {
  const ray = viewportToWorld(world, world.resource(RtsView).camera, x, y)
  if (!ray || ray.dir[1] >= 0) return null
  const map = world.resource(Terrain)
  const [ox, oy, oz] = ray.origin
  const [dx, dy, dz] = ray.dir
  const above = (t: number): number => oy + dy * t - terrainHeight(map, ox + dx * t, oz + dz * t)
  const end = (map.min - oy) / dy
  let near = Math.max((map.max - oy) / dy, 0)
  let far = near
  while (above(far) > 0) {
    near = far
    far += MARCH_STEP
    if (far >= end) {
      far = end
      break
    }
  }
  for (let i = 0; i < REFINE_STEPS; i++) {
    const middle = (near + far) / 2
    if (above(middle) > 0) near = middle
    else far = middle
  }
  const px = ox + dx * far
  const pz = oz + dz * far
  return Math.abs(px) <= HALF_MAP && Math.abs(pz) <= HALF_MAP ? { x: px, z: pz } : null
}
