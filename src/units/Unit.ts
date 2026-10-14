import type { Vector3 } from '@babylonjs/core'

export interface Unit {
  id: number
  position: Vector3
  target: Vector3 | null
  heading: number
  /** Heading to snap to on reaching `target`. */
  arrivalHeading: number | null
  selected: boolean
}
