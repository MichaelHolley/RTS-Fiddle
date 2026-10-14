import { FORMATION_SPACING } from '../config'
import type { SlotOffset } from '../units/Formation'
import type { Unit } from '../units/Unit'

export interface SquareLayout {
  /** Rows ordered front to back, each ordered left to right. */
  rows: SlotOffset[][]
  width: number
  depth: number
}

export function squareLayout(count: number, spacing = FORMATION_SPACING): SquareLayout {
  const cols = Math.ceil(Math.sqrt(count))
  const rowCount = Math.ceil(count / cols)
  const rows = Array.from({ length: rowCount }, (_, r) => {
    const inRow = Math.min(cols, count - r * cols)
    const z = ((rowCount - 1) / 2 - r) * spacing
    return Array.from({ length: inRow }, (_, c) => ({ x: (c - (inRow - 1) / 2) * spacing, z }))
  })
  return { rows, width: cols * spacing, depth: rowCount * spacing }
}

/** Fills rows front to back with the most forward units, ordered left to right, to minimize crossing paths. */
export function assignSlots(units: readonly Unit[], layout: SquareLayout, facing: number): Map<Unit, SlotOffset> {
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
