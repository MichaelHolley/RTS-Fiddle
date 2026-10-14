import type { Vector3 } from '@babylonjs/core'

export interface Unit {
  id: number
  position: Vector3
  target: Vector3 | null
  heading: number
  selected: boolean
}
