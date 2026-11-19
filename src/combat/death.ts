import { Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import { FORMATION_SPACING } from '../config'
import { Combatant, Soldier, SoldierGlow, Unit } from '../units/components'
import { assignSlots, gridLayout } from '../units/formation'
import type { Placed } from '../units/formation'
import { MoveSystem } from '../units/movement'
import { RangedSystem } from './ranged'

const SOLDIERS = [Soldier, Combatant]

const Losses: Resource<Map<number, Placed[]>> = { create: () => new Map() }

/**
 * Survivors close ranks: the block keeps its files and loses rear ranks. The center moves up so the front rank stays
 * put, as rear ranks step forward to fill the front in Total War, instead of the whole block backing off the fight.
 */
function closeRanks(world: World, unit: number, survivors: Placed[]): void {
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const facing = units.facing.get(unit)
  const layout = gridLayout(survivors.length, Math.min(units.files.get(unit), survivors.length))
  const advance = ((units.ranks.get(unit) - layout.rows.length) * FORMATION_SPACING) / 2
  if (advance !== 0) {
    const { center, destination } = units
    const halted = center.x.get(unit) === destination.x.get(unit) && center.z.get(unit) === destination.z.get(unit)
    const x = center.x.get(unit) + Math.sin(facing) * advance
    const z = center.z.get(unit) + Math.cos(facing) * advance
    center.x.set(unit, x)
    center.z.set(unit, z)
    if (halted) {
      destination.x.set(unit, x)
      destination.z.set(unit, z)
    }
  }
  units.files.set(unit, layout.rows[0].length)
  units.ranks.set(unit, layout.rows.length)
  for (const [eid, slot] of assignSlots(survivors, layout, facing)) {
    soldiers.slotX.set(eid, slot.x)
    soldiers.slotZ.set(eid, slot.z)
  }
}

/** Removes soldiers out of health; a unit with no soldiers left is destroyed. */
function removeDead(world: World): void {
  const losses = world.resource(Losses)
  losses.clear()
  const soldiers = world.storage(Soldier)
  const { health } = world.storage(Combatant)
  const glows = world.storage(SoldierGlow)
  const dead: number[] = []
  for (const eid of world.query(SOLDIERS)) {
    if (health.get(eid) > 0) continue
    dead.push(eid)
    losses.set(soldiers.unit.get(eid), [])
  }
  if (dead.length === 0) return
  for (const eid of dead) {
    if (world.has(eid, SoldierGlow)) world.destroy(glows.entity.get(eid))
    world.destroy(eid)
  }

  const { translation } = world.storage(Transform)
  for (const eid of world.query(SOLDIERS)) {
    losses.get(soldiers.unit.get(eid))?.push({ eid, x: translation.x.get(eid), z: translation.z.get(eid) })
  }
  for (const [unit, survivors] of losses) {
    if (survivors.length === 0) world.destroy(unit)
    else closeRanks(world, unit, survivors)
  }
}

export const DeathSystem: System = {
  name: 'death',
  group: 'fixed',
  after: [RangedSystem],
  before: [MoveSystem],
  update: removeDead,
}
