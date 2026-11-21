import type { System, World } from '@dylanebert/shallot'
import { ATTACK_APPROACH, UNIT_TYPES } from '../config'
import type { UnitTypeId } from '../config'
import { AttackOrder, Unit } from '../units/components'
import { UnitSystem } from '../units/movement'
import { Melee } from './engagement'

const ATTACKERS = [Unit, AttackOrder]

function marchTo(world: World, unit: number, x: number, z: number, facing: number): void {
  const { destination, facing: facings } = world.storage(Unit)
  destination.x.set(unit, x)
  destination.z.set(unit, z)
  facings.set(unit, facing)
}

function halt(world: World, unit: number): void {
  const { center, destination } = world.storage(Unit)
  destination.x.set(unit, center.x.get(unit))
  destination.z.set(unit, center.z.get(unit))
}

/**
 * Total War attack order: melee units march at the target, following it until their soldiers make contact, and chase
 * again once the fight around them ends. Ranged units close to `ATTACK_APPROACH` of their range and hold there.
 * Units already fighting hold where they are, whoever they fight. The order ends when the target is destroyed.
 */
function pursue(world: World): void {
  const units = world.storage(Unit)
  const orders = world.storage(AttackOrder)
  const { engaged, closing } = world.resource(Melee)
  const ended: number[] = []
  for (const unit of world.query(ATTACKERS)) {
    const target = orders.target.get(unit)
    if (target === 0 || !world.has(target, Unit)) {
      ended.push(unit)
      continue
    }
    if (engaged.has(unit) || closing.has(unit)) {
      halt(world, unit)
      continue
    }
    const x = units.center.x.get(unit)
    const z = units.center.z.get(unit)
    const dx = units.center.x.get(target) - x
    const dz = units.center.z.get(target) - z
    const distance = Math.hypot(dx, dz)
    if (distance < 1e-3) continue
    const facing = Math.atan2(dx, dz)
    const ranged = UNIT_TYPES[units.type.get(unit) as UnitTypeId].ranged
    if (!ranged) {
      marchTo(world, unit, x + dx, z + dz, facing)
      continue
    }
    const halted = x === units.destination.x.get(unit) && z === units.destination.z.get(unit)
    if (halted && distance <= ranged.range) continue
    const advance = Math.max(distance - ranged.range * ATTACK_APPROACH, 0) / distance
    marchTo(world, unit, x + dx * advance, z + dz * advance, facing)
  }
  for (const unit of ended) {
    world.remove(unit, AttackOrder)
    halt(world, unit)
  }
}

export const AttackSystem: System = {
  name: 'attack',
  group: 'fixed',
  before: [UnitSystem],
  update: pursue,
}
