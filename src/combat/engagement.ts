import { Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import { ATTACK_JITTER, MELEE_REACH, MELEE_SEEK_RADIUS, SOLDIER_COUNT, SOLDIER_RADIUS, UNIT_TYPES } from '../config'
import type { UnitTypeId } from '../config'
import { cellBucket, createCellGrid, fillCellGrid } from '../units/cellGrid'
import type { CellGrid } from '../units/cellGrid'
import { Combatant, MoveTarget, Soldier, Unit } from '../units/components'
import { slotToWorld } from '../units/formation'
import type { Point } from '../units/formation'
import { MoveSystem, UnitScratch, UnitSystem } from '../units/movement'

const BODY_DISTANCE = SOLDIER_RADIUS * 2
const CONTACT_DISTANCE = BODY_DISTANCE + MELEE_REACH

const SOLDIERS = [Soldier, Combatant]

interface MeleeState {
  /** Soldiers within blow reach of an enemy this tick; they fight instead of firing. */
  fighting: Set<number>
  /** Units with a soldier fighting this tick. */
  engaged: Set<number>
  wasEngaged: Set<number>
  cells: CellGrid
  eids: Uint32Array
  factions: Uint32Array
  xs: Float32Array
  zs: Float32Array
  slot: Point
  offset: Point
  center: Point
}

export const Melee: Resource<MeleeState> = {
  create: () => ({
    fighting: new Set(),
    engaged: new Set(),
    wasEngaged: new Set(),
    // Cells as wide as the seek radius, so the 3×3 neighbouring cells hold every enemy worth closing with.
    cells: createCellGrid(MELEE_SEEK_RADIUS, SOLDIER_COUNT),
    eids: new Uint32Array(SOLDIER_COUNT),
    factions: new Uint32Array(SOLDIER_COUNT),
    xs: new Float32Array(SOLDIER_COUNT),
    zs: new Float32Array(SOLDIER_COUNT),
    slot: { x: 0, z: 0 },
    offset: { x: 0, z: 0 },
    center: { x: 0, z: 0 },
  }),
}

/** Seconds until a soldier's next blow or shot. */
export function cooldownAfter(interval: number): number {
  return interval * (1 + (Math.random() * 2 - 1) * ATTACK_JITTER)
}

function setMoveTarget(world: World, eid: number, x: number, z: number, heading: number): void {
  if (!world.has(eid, MoveTarget)) {
    world.add(eid, MoveTarget, { x, z, heading })
    return
  }
  const targets = world.storage(MoveTarget)
  targets.x.set(eid, x)
  targets.z.set(eid, z)
  targets.heading.set(eid, heading)
}

function slotOf(world: World, state: MeleeState, eid: number, unit: number): Point {
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  state.center.x = units.center.x.get(unit)
  state.center.z = units.center.z.get(unit)
  state.offset.x = soldiers.slotX.get(eid)
  state.offset.z = soldiers.slotZ.get(eid)
  return slotToWorld(state.center, units.facing.get(unit), state.offset, state.slot)
}

function collect(world: World, state: MeleeState): number {
  const { eids, factions, xs, zs } = state
  const { faction } = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const { cooldown } = world.storage(Combatant)
  const { translation } = world.storage(Transform)
  const dt = world.time.deltaTime
  let count = 0
  for (const eid of world.query(SOLDIERS)) {
    eids[count] = eid
    factions[count] = faction.get(soldiers.unit.get(eid))
    xs[count] = translation.x.get(eid)
    zs[count] = translation.z.get(eid)
    const left = cooldown.get(eid)
    if (left > 0) cooldown.set(eid, Math.max(left - dt, 0))
    count++
  }
  return count
}

/**
 * Soldiers within `MELEE_REACH` of an enemy trade blows, whether their unit is marching or not. Soldiers of a halted
 * melee unit leave their slot to close with enemies within `MELEE_SEEK_RADIUS` of it, so two blocks that meet dissolve
 * into a brawl as in Total War; the leash to the slot stops them chasing a fleeing enemy across the map.
 * A marching unit halts the moment it first makes contact; ordered away afterwards, it disengages.
 */
function engage(world: World): void {
  const state = world.resource(Melee)
  const { cells, eids, factions, xs, zs, fighting } = state
  const { bucketHead, nextInBucket, columns, rows } = cells
  const { marching } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const combatants = world.storage(Combatant)
  const previous = state.wasEngaged
  state.wasEngaged = state.engaged
  state.engaged = previous
  state.engaged.clear()
  fighting.clear()

  const count = collect(world, state)
  fillCellGrid(cells, xs, zs, count)

  for (let i = 0; i < count; i++) {
    const eid = eids[i]
    const unit = soldiers.unit.get(eid)
    const type = UNIT_TYPES[units.type.get(unit) as UnitTypeId]
    const halted = !marching.has(unit)
    const seeks = halted && !type.ranged
    const slot = seeks ? slotOf(world, state, eid, unit) : undefined
    let foe = -1
    let foeDistance = Infinity
    let quarry = -1
    let quarryDistance = Infinity
    for (let r = rows[i] - 1; r <= rows[i] + 1; r++) {
      for (let c = columns[i] - 1; c <= columns[i] + 1; c++) {
        for (let j = bucketHead[cellBucket(cells, c, r)]; j !== -1; j = nextInBucket[j]) {
          if (columns[j] !== c || rows[j] !== r || factions[j] === factions[i]) continue
          const distance = Math.hypot(xs[j] - xs[i], zs[j] - zs[i])
          if (distance < foeDistance) {
            foe = j
            foeDistance = distance
          }
          if (!slot || distance >= quarryDistance) continue
          if (Math.hypot(xs[j] - slot.x, zs[j] - slot.z) > MELEE_SEEK_RADIUS) continue
          quarry = j
          quarryDistance = distance
        }
      }
    }

    if (foe !== -1 && foeDistance <= CONTACT_DISTANCE) {
      fighting.add(eid)
      state.engaged.add(unit)
      if (combatants.cooldown.get(eid) <= 0) {
        const target = eids[foe]
        combatants.health.set(target, combatants.health.get(target) - type.melee.damage)
        combatants.cooldown.set(eid, cooldownAfter(type.melee.interval))
      }
      if (halted) setMoveTarget(world, eid, xs[i], zs[i], Math.atan2(xs[foe] - xs[i], zs[foe] - zs[i]))
      continue
    }
    if (quarry === -1) continue
    const dx = xs[quarry] - xs[i]
    const dz = zs[quarry] - zs[i]
    const stop = BODY_DISTANCE / quarryDistance
    setMoveTarget(world, eid, xs[quarry] - dx * stop, zs[quarry] - dz * stop, Math.atan2(dx, dz))
  }

  for (const unit of state.engaged) {
    if (state.wasEngaged.has(unit) || !marching.has(unit)) continue
    units.destination.x.set(unit, units.center.x.get(unit))
    units.destination.z.set(unit, units.center.z.get(unit))
    marching.delete(unit)
  }
}

export const EngagementSystem: System = {
  name: 'engagement',
  group: 'fixed',
  after: [UnitSystem],
  before: [MoveSystem],
  update: engage,
}
