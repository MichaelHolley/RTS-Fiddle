import { FORMATION_SPACING, UNIT_GAP, UNIT_MIN_FILES } from '../config'

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
  /** Ranks ordered front to back, each ordered left to right. */
  rows: SlotOffset[][]
}

export interface FormationPlan {
  layout: GridLayout
  center: Point
  facing: number
}

export interface UnitPlan extends FormationPlan {
  unit: number
}

/** A unit as order planning sees it: its current center and facing, soldier count and front-rank width. */
export interface UnitPose extends Point {
  unit: number
  facing: number
  count: number
  files: number
}

export interface Placed extends Point {
  eid: number
}

export interface Footprint {
  halfWidth: number
  front: number
  back: number
}

export function gridLayout(count: number, files: number, spacing = FORMATION_SPACING): GridLayout {
  const rowCount = Math.ceil(count / files)
  const rows = Array.from({ length: rowCount }, (_, r) => {
    const inRow = Math.min(files, count - r * files)
    const z = ((rowCount - 1) / 2 - r) * spacing
    return Array.from({ length: inRow }, (_, c) => ({ x: (c - (inRow - 1) / 2) * spacing, z }))
  })
  return { rows }
}

/** Formation-space rectangle around a block of `files` by `ranks` slots, padded by half a slot. */
export function footprint(files: number, ranks: number, spacing = FORMATION_SPACING): Footprint {
  const halfWidth = (files * spacing) / 2
  const front = (ranks * spacing) / 2
  return { halfWidth, front, back: -front }
}

/**
 * Total War right-click: the selection keeps its shape and each unit its width, all turned to face the direction
 * of travel from the selection's center to `destination`.
 */
export function planMove(destination: Point, units: readonly UnitPose[]): UnitPlan[] {
  let cx = 0
  let cz = 0
  let sin = 0
  let cos = 0
  for (const unit of units) {
    cx += unit.x / units.length
    cz += unit.z / units.length
    sin += Math.sin(unit.facing)
    cos += Math.cos(unit.facing)
  }
  const current = Math.atan2(sin, cos)
  const dx = destination.x - cx
  const dz = destination.z - cz
  const facing = Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, dz) : current
  const turnSin = Math.sin(facing - current)
  const turnCos = Math.cos(facing - current)
  return units.map((unit) => {
    const ox = unit.x - cx
    const oz = unit.z - cz
    return {
      unit: unit.unit,
      layout: gridLayout(unit.count, unit.files),
      center: { x: destination.x + ox * turnCos + oz * turnSin, z: destination.z - ox * turnSin + oz * turnCos },
      facing,
    }
  })
}

/**
 * Total War right-drag: the line from `start` to `end` is the front rank, shared between units by soldier count and
 * filled in their current left-to-right order. The drag direction becomes the units' right, so a left-to-right drag
 * on screen faces away from the camera and a right-to-left drag faces toward it.
 */
export function planFrontage(start: Point, end: Point, units: readonly UnitPose[]): UnitPlan[] {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const length = Math.hypot(dx, dz)
  const ux = length > 0 ? dx / length : 1
  const uz = length > 0 ? dz / length : 0
  const facing = Math.atan2(uz, -ux)
  const forwardX = Math.sin(facing)
  const forwardZ = Math.cos(facing)

  const along = (unit: UnitPose): number => (unit.x - start.x) * ux + (unit.z - start.z) * uz
  const ordered = [...units].sort((a, b) => along(a) - along(b))
  const soldiers = ordered.reduce((sum, unit) => sum + unit.count, 0)
  const available = Math.max(length - UNIT_GAP * (ordered.length - 1), 0)

  const shaped = ordered.map((unit) => {
    const share = (available * unit.count) / soldiers
    const minFiles = Math.min(UNIT_MIN_FILES, unit.count)
    const files = Math.min(Math.max(Math.round(share / FORMATION_SPACING) + 1, minFiles), unit.count)
    return { unit, layout: gridLayout(unit.count, files), width: Math.max(share, (files - 1) * FORMATION_SPACING) }
  })

  const used = shaped.reduce((sum, { width }) => sum + width, 0) + UNIT_GAP * (shaped.length - 1)
  let cursor = (length - used) / 2
  return shaped.map(({ unit, layout, width }) => {
    const middle = cursor + width / 2
    cursor += width + UNIT_GAP
    const back = ((layout.rows.length - 1) * FORMATION_SPACING) / 2
    return {
      unit: unit.unit,
      layout,
      center: { x: start.x + ux * middle - forwardX * back, z: start.z + uz * middle - forwardZ * back },
      facing,
    }
  })
}

/** World position of a formation slot: forward is `(sin, cos)` of `facing`, right is `forward x up`. */
export function slotToWorld(center: Point, facing: number, offset: SlotOffset, out: Point): Point {
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  out.x = center.x - offset.x * cos + offset.z * sin
  out.z = center.z + offset.x * sin + offset.z * cos
  return out
}

/** Fills ranks front to back with the most forward soldiers, ordered left to right, to minimize crossing paths. */
export function assignSlots(soldiers: readonly Placed[], layout: GridLayout, facing: number): Map<number, SlotOffset> {
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  const lateral = (soldier: Placed): number => -soldier.x * cos + soldier.z * sin
  const forward = (soldier: Placed): number => soldier.x * sin + soldier.z * cos

  const byForward = [...soldiers].sort((a, b) => forward(b) - forward(a))
  const assignments = new Map<number, SlotOffset>()
  let start = 0
  for (const row of layout.rows) {
    const rowSoldiers = byForward.slice(start, start + row.length).sort((a, b) => lateral(a) - lateral(b))
    rowSoldiers.forEach((soldier, i) => assignments.set(soldier.eid, row[i]))
    start += row.length
  }
  return assignments
}

/** Splits a unit into a left and a right half standing side by side on its current front rank, keeping its facing. */
export function planSplit(unit: UnitPose): [FormationPlan, FormationPlan] {
  const leftCount = Math.ceil(unit.count / 2)
  const rightCount = unit.count - leftCount
  const leftFiles = Math.min(Math.ceil(unit.files / 2), leftCount)
  const rightFiles = Math.min(Math.max(unit.files - leftFiles, 1), rightCount)
  const leftWidth = (leftFiles - 1) * FORMATION_SPACING
  const rightWidth = (rightFiles - 1) * FORMATION_SPACING
  const halfSpan = (leftWidth + rightWidth + UNIT_GAP) / 2
  const front = ((Math.ceil(unit.count / unit.files) - 1) * FORMATION_SPACING) / 2
  const half = (count: number, files: number, x: number): FormationPlan => {
    const layout = gridLayout(count, files)
    const back = ((layout.rows.length - 1) * FORMATION_SPACING) / 2
    const center = slotToWorld(unit, unit.facing, { x, z: front - back }, { x: 0, z: 0 })
    return { layout, center, facing: unit.facing }
  }
  return [half(leftCount, leftFiles, leftWidth / 2 - halfSpan), half(rightCount, rightFiles, halfSpan - rightWidth / 2)]
}

/** Joins units into one block at their soldier-weighted center, as wide as their fronts combined, facing like the first. */
export function planJoin(units: readonly UnitPose[]): FormationPlan {
  const count = units.reduce((sum, unit) => sum + unit.count, 0)
  const files = Math.min(units.reduce((sum, unit) => sum + unit.files, 0), count)
  const center = { x: 0, z: 0 }
  for (const unit of units) {
    center.x += (unit.x * unit.count) / count
    center.z += (unit.z * unit.count) / count
  }
  return { layout: gridLayout(count, files), center, facing: units[0].facing }
}
