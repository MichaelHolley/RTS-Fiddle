import { Vector3 } from '@babylonjs/core'
import { FORMATION_SPACING } from '../config'

export function gridSlots(
  center: Vector3,
  count: number,
  facing: number,
  spacing = FORMATION_SPACING,
): Vector3[] {
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)

  return Array.from({ length: count }, (_, i) => {
    const localX = ((i % cols) - (cols - 1) / 2) * spacing
    const localZ = ((rows - 1) / 2 - Math.floor(i / cols)) * spacing
    return new Vector3(
      center.x + localX * cos + localZ * sin,
      center.y,
      center.z - localX * sin + localZ * cos,
    )
  })
}
