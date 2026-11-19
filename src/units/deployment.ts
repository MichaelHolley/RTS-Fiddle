import { ARMY_DISTANCE, CAMERA } from '../config'
import type { FactionId } from '../config'
import type { Point } from './formation'

export interface Deployment {
  origin: Point
  facing: number
}

/** The armies face each other `ARMY_DISTANCE` apart across the map center; Blue faces away from the starting camera. */
export function deployment(faction: FactionId): Deployment {
  const facing = CAMERA.yaw + Math.PI * (faction + 1)
  const back = ARMY_DISTANCE / 2
  return { origin: { x: -Math.sin(facing) * back, z: -Math.cos(facing) * back }, facing }
}
