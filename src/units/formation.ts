import { FORMATION_SPACING } from '../config'

export interface Point {
  x: number
  z: number
}

/** Slot position in formation space: `x` to the right, `z` forward. */
export interface SlotOffset {
  x: number
  z: number
}

export interface GridLayout {
  /** Rows ordered front to back, each ordered left to right. */
  rows: SlotOffset[][]
}

export interface FormationPlan {
  layout: GridLayout
  center: Point
  facing: number
}

export interface Placed extends Point {
  eid: number
}

export function gridLayout(count: number, cols = Math.ceil(Math.sqrt(count)), spacing = FORMATION_SPACING): GridLayout {
  const rowCount = Math.ceil(count / cols)
  const rows = Array.from({ length: rowCount }, (_, r) => {
    const inRow = Math.min(cols, count - r * cols)
    const z = ((rowCount - 1) / 2 - r) * spacing
    return Array.from({ length: inRow }, (_, c) => ({ x: (c - (inRow - 1) / 2) * spacing, z }))
  })
  return { rows }
}

export function planSquare(from: Point, destination: Point, count: number): FormationPlan {
  return {
    layout: gridLayout(count),
    center: { x: destination.x, z: destination.z },
    facing: Math.atan2(destination.x - from.x, destination.z - from.z),
  }
}

/**
 * Front row spans `start` to `end`, left to right in formation space. The world is right-handed, so a
 * left-to-right drag on screen puts the units' right toward `end` and they face away from the camera.
 */
export function planLine(start: Point, end: Point, count: number, spacing = FORMATION_SPACING): FormationPlan {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const cols = Math.min(count, Math.round(Math.hypot(dx, dz) / spacing) + 1)
  const layout = gridLayout(count, cols, spacing)
  const facing = Math.atan2(dz, -dx)
  const back = ((layout.rows.length - 1) * spacing) / 2
  const center = {
    x: (start.x + end.x) / 2 - Math.sin(facing) * back,
    z: (start.z + end.z) / 2 - Math.cos(facing) * back,
  }
  return { layout, center, facing }
}

/** World position of a formation slot: forward is `(sin, cos)` of `facing`, right is `forward x up`. */
export function slotToWorld(center: Point, facing: number, offset: SlotOffset, out: Point): Point {
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  out.x = center.x - offset.x * cos + offset.z * sin
  out.z = center.z + offset.x * sin + offset.z * cos
  return out
}

/** Fills rows front to back with the most forward units, ordered left to right, to minimize crossing paths. */
export function assignSlots(units: readonly Placed[], layout: GridLayout, facing: number): Map<number, SlotOffset> {
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  const lateral = (unit: Placed): number => -unit.x * cos + unit.z * sin
  const forward = (unit: Placed): number => unit.x * sin + unit.z * cos

  const byForward = [...units].sort((a, b) => forward(b) - forward(a))
  const assignments = new Map<number, SlotOffset>()
  let start = 0
  for (const row of layout.rows) {
    const rowUnits = byForward.slice(start, start + row.length).sort((a, b) => lateral(a) - lateral(b))
    rowUnits.forEach((unit, i) => assignments.set(unit.eid, row[i]))
    start += row.length
  }
  return assignments
}
