import { Vector3 } from '@babylonjs/core'
import { FORMATION_SPACING } from '../config'
import type { SlotOffset } from '../units/Formation'
import type { Unit } from '../units/Unit'

export interface GridLayout {
  /** Rows ordered front to back, each ordered left to right. */
  rows: SlotOffset[][]
  width: number
  depth: number
}

export interface FormationPlan {
  layout: GridLayout
  center: Vector3
  facing: number
}

export function gridLayout(count: number, cols = Math.ceil(Math.sqrt(count)), spacing = FORMATION_SPACING): GridLayout {
  const rowCount = Math.ceil(count / cols)
  const rows = Array.from({ length: rowCount }, (_, r) => {
    const inRow = Math.min(cols, count - r * cols)
    const z = ((rowCount - 1) / 2 - r) * spacing
    return Array.from({ length: inRow }, (_, c) => ({ x: (c - (inRow - 1) / 2) * spacing, z }))
  })
  return { rows, width: cols * spacing, depth: rowCount * spacing }
}

export function planSquare(from: Vector3, destination: Vector3, count: number): FormationPlan {
  return {
    layout: gridLayout(count),
    center: destination.clone(),
    facing: Math.atan2(destination.x - from.x, destination.z - from.z),
  }
}

/** Front row spans `start` to `end`; units face to the left of the drag direction, so a left-to-right drag faces away from the camera. */
export function planLine(start: Vector3, end: Vector3, count: number, spacing = FORMATION_SPACING): FormationPlan {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const cols = Math.min(count, Math.round(Math.hypot(dx, dz) / spacing) + 1)
  const layout = gridLayout(count, cols, spacing)
  const facing = Math.atan2(-dz, dx)
  const back = (layout.rows.length - 1) * spacing / 2
  const center = new Vector3(
    (start.x + end.x) / 2 - Math.sin(facing) * back,
    start.y,
    (start.z + end.z) / 2 - Math.cos(facing) * back,
  )
  return { layout, center, facing }
}

/** Fills rows front to back with the most forward units, ordered left to right, to minimize crossing paths. */
export function assignSlots(units: readonly Unit[], layout: GridLayout, facing: number): Map<Unit, SlotOffset> {
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  const lateral = (unit: Unit): number => unit.position.x * cos - unit.position.z * sin
  const forward = (unit: Unit): number => unit.position.x * sin + unit.position.z * cos

  const byForward = [...units].sort((a, b) => forward(b) - forward(a))
  const assignments = new Map<Unit, SlotOffset>()
  let start = 0
  for (const row of layout.rows) {
    const rowUnits = byForward.slice(start, start + row.length).sort((a, b) => lateral(a) - lateral(b))
    rowUnits.forEach((unit, i) => assignments.set(unit, row[i]))
    start += row.length
  }
  return assignments
}
