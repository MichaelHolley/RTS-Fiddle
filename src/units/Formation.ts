import { Vector3 } from '@babylonjs/core'
import { FORMATION_REFORM_DISTANCE, FORMATION_SPEED } from '../config'
import type { Unit } from './Unit'

const SETTLE_DISTANCE = 0.2

/** Slot position in formation space: `x` to the right, `z` forward. */
export interface SlotOffset {
  x: number
  z: number
}

export class Formation {
  readonly center: Vector3
  readonly destination: Vector3
  readonly facing: number
  readonly slots: Map<Unit, SlotOffset>

  private readonly sin: number
  private readonly cos: number
  private readonly slot = new Vector3()

  constructor(
    start: Vector3,
    destination: Vector3,
    facing: number,
    slots: Map<Unit, SlotOffset>,
  ) {
    this.center = start.clone()
    this.destination = destination.clone()
    this.facing = facing
    this.slots = slots
    this.sin = Math.sin(facing)
    this.cos = Math.cos(facing)
  }

  release(units: Iterable<Unit>): void {
    for (const unit of units) this.slots.delete(unit)
  }

  /** Marches the formation and retargets its members. Returns false once the formation has settled. */
  update(dt: number): boolean {
    let maxLag = 0
    for (const [unit, offset] of this.slots) {
      const slot = this.slotPosition(offset)
      maxLag = Math.max(maxLag, Math.hypot(slot.x - unit.position.x, slot.z - unit.position.z))
    }

    const dx = this.destination.x - this.center.x
    const dz = this.destination.z - this.center.z
    const remaining = Math.hypot(dx, dz)
    if (remaining === 0 && maxLag <= SETTLE_DISTANCE) return false

    if (maxLag <= FORMATION_REFORM_DISTANCE) {
      const step = FORMATION_SPEED * dt
      if (remaining <= step) {
        this.center.x = this.destination.x
        this.center.z = this.destination.z
      } else {
        this.center.x += (dx / remaining) * step
        this.center.z += (dz / remaining) * step
      }
    }

    for (const [unit, offset] of this.slots) {
      const slot = this.slotPosition(offset)
      const target = (unit.target ??= unit.position.clone())
      target.x = slot.x
      target.z = slot.z
    }
    return true
  }

  private slotPosition({ x, z }: SlotOffset): Vector3 {
    const { center, sin, cos } = this
    return this.slot.set(center.x + x * cos + z * sin, center.y, center.z - x * sin + z * cos)
  }
}
