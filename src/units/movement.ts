import { Transform } from '@dylanebert/shallot'
import type { Resource, System, Vector4Field, World } from '@dylanebert/shallot'
import { SOLDIER_SPEED, SOLDIER_TURN_SPEED, UNIT_DRIFT_DISTANCE, UNIT_REFORM_DISTANCE, UNIT_SPEED } from '../config'
import { MoveTarget, Soldier, Unit } from './components'
import { slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'

const ARRIVE_DISTANCE = 0.1

const UNITS = [Unit]
const SOLDIERS = [Soldier]
const MOVERS = [Soldier, MoveTarget]

export const UnitScratch: Resource<{
  lags: Map<number, number>
  marching: Map<number, number>
  center: Point
  offset: SlotOffset
  slot: Point
}> = {
  create: () => ({
    lags: new Map(),
    marching: new Map(),
    center: { x: 0, z: 0 },
    offset: { x: 0, z: 0 },
    slot: { x: 0, z: 0 },
  }),
}

export function setHeading(rotation: Vector4Field, eid: number, heading: number): void {
  rotation.set(eid, 0, Math.sin(heading / 2), 0, Math.cos(heading / 2))
}

/** Turns a soldier toward `target` by at most `maxTurn` radians; returns whether it now faces `target`. */
function turnToward(rotation: Vector4Field, eid: number, target: number, maxTurn: number): boolean {
  const current = 2 * Math.atan2(rotation.y.get(eid), rotation.w.get(eid))
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  if (Math.abs(delta) <= maxTurn) {
    setHeading(rotation, eid, target)
    return true
  }
  setHeading(rotation, eid, current + Math.sign(delta) * maxTurn)
  return false
}

function isIdle(world: World, unit: number): boolean {
  const { center, destination } = world.storage(Unit)
  return center.x.get(unit) === destination.x.get(unit) && center.z.get(unit) === destination.z.get(unit)
}

function soldierSlot(world: World, soldier: number, unit: number): Point {
  const { center, offset, slot } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  center.x = units.center.x.get(unit)
  center.z = units.center.z.get(unit)
  offset.x = soldiers.slotX.get(soldier)
  offset.z = soldiers.slotZ.get(soldier)
  return slotToWorld(center, units.facing.get(unit), offset, slot)
}

function setMoveTarget(world: World, eid: number, slot: Point, heading: number): void {
  if (!world.has(eid, MoveTarget)) {
    world.add(eid, MoveTarget, { x: slot.x, z: slot.z, heading })
    return
  }
  const targets = world.storage(MoveTarget)
  targets.x.set(eid, slot.x)
  targets.z.set(eid, slot.z)
  targets.heading.set(eid, heading)
}

// A unit's center only advances while every soldier is within reform distance of its slot, so the block stays whole.
function updateUnits(world: World): void {
  const { lags, marching } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  lags.clear()
  marching.clear()

  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    const slot = soldierSlot(world, eid, unit)
    const lag = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (lag > (lags.get(unit) ?? 0)) lags.set(unit, lag)
  }

  const { center, destination } = units
  for (const unit of world.query(UNITS)) {
    const dx = destination.x.get(unit) - center.x.get(unit)
    const dz = destination.z.get(unit) - center.z.get(unit)
    const remaining = Math.hypot(dx, dz)
    if (remaining === 0) continue
    if ((lags.get(unit) ?? 0) <= UNIT_REFORM_DISTANCE) {
      const step = UNIT_SPEED * world.time.deltaTime
      if (remaining <= step) {
        center.x.set(unit, destination.x.get(unit))
        center.z.set(unit, destination.z.get(unit))
        continue
      }
      center.x.set(unit, center.x.get(unit) + (dx / remaining) * step)
      center.z.set(unit, center.z.get(unit) + (dz / remaining) * step)
    }
    marching.set(unit, Math.atan2(dx, dz))
  }

  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    const slot = soldierSlot(world, eid, unit)
    const heading = marching.get(unit)
    if (heading !== undefined) {
      setMoveTarget(world, eid, slot, heading)
      continue
    }
    const drift = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (!world.has(eid, MoveTarget) && drift <= UNIT_DRIFT_DISTANCE) continue
    setMoveTarget(world, eid, slot, units.facing.get(unit))
  }
}

function moveSoldiers(world: World): void {
  const step = SOLDIER_SPEED * world.time.deltaTime
  const maxTurn = SOLDIER_TURN_SPEED * world.time.deltaTime
  const { translation, rotation } = world.storage(Transform)
  const targets = world.storage(MoveTarget)
  const soldiers = world.storage(Soldier)

  for (const eid of world.query(MOVERS)) {
    const dx = targets.x.get(eid) - translation.x.get(eid)
    const dz = targets.z.get(eid) - translation.z.get(eid)
    const distance = Math.hypot(dx, dz)
    if (distance <= ARRIVE_DISTANCE || distance <= step) {
      if (dx !== 0) translation.x.set(eid, targets.x.get(eid))
      if (dz !== 0) translation.z.set(eid, targets.z.get(eid))
      const facing = turnToward(rotation, eid, targets.heading.get(eid), maxTurn)
      if (facing && isIdle(world, soldiers.unit.get(eid))) world.remove(eid, MoveTarget)
      continue
    }
    turnToward(rotation, eid, Math.atan2(dx, dz), maxTurn)
    translation.x.set(eid, translation.x.get(eid) + (dx / distance) * step)
    translation.z.set(eid, translation.z.get(eid) + (dz / distance) * step)
  }
}

export const UnitSystem: System = {
  name: 'units',
  group: 'fixed',
  update: updateUnits,
}

export const MoveSystem: System = {
  name: 'move',
  group: 'fixed',
  after: [UnitSystem],
  update: moveSoldiers,
}
