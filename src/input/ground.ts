import type { World } from '@dylanebert/shallot'
import { viewportToWorld } from '@dylanebert/shallot/rendering'
import { MAP_SIZE } from '../config'
import { RtsView } from '../scene/world'
import type { Point } from '../units/formation'

const HALF_MAP = MAP_SIZE / 2

export function pickGround(world: World, x: number, y: number): Point | null {
  const ray = viewportToWorld(world, world.resource(RtsView).camera, x, y)
  if (!ray || ray.dir[1] >= 0) return null
  const t = -ray.origin[1] / ray.dir[1]
  const px = ray.origin[0] + ray.dir[0] * t
  const pz = ray.origin[2] + ray.dir[2] * t
  return Math.abs(px) <= HALF_MAP && Math.abs(pz) <= HALF_MAP ? { x: px, z: pz } : null
}
