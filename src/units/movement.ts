import { Transform } from '@dylanebert/shallot'
import type { Resource, System, Vector4Field, World } from '@dylanebert/shallot'
import {
  SOLDIER_CATCH_UP,
  SOLDIER_RADIUS,
  SOLDIER_SPRINT,
  SOLDIER_TURN_SPEED,
  UNIT_DRIFT_DISTANCE,
  UNIT_REFORM_DISTANCE,
  UNIT_STRAGGLER_SHARE,
  UNIT_TYPES,
} from '../config'
import type { UnitTypeId } from '../config'
import { findObstacles, isBlocked, Obstacles, pushOutOfObstacles } from '../terrain/obstacles'
import type { ObstacleField } from '../terrain/obstacles'
import { MoveTarget, Soldier, Unit } from './components'
import { slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'

const ARRIVE_DISTANCE = 0.1
/** Metres ahead a soldier starts walking around an obstacle. */
const STEER_LOOKAHEAD = 2
// Each pass bends past one more obstacle, enough to thread the gap between neighbouring trees.
const STEER_PASSES = 3

const UNITS = [Unit]
const SOLDIERS = [Soldier]
const MOVERS = [Soldier, MoveTarget]

export const UnitScratch: Resource<{
  sizes: Map<number, number>
  stragglers: Map<number, number>
  marching: Map<number, number>
  center: Point
  offset: SlotOffset
  slot: Point
}> = {
  create: () => ({
    sizes: new Map(),
    stragglers: new Map(),
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

function unitSpeed(world: World, unit: number): number {
  return UNIT_TYPES[world.storage(Unit).type.get(unit) as UnitTypeId].speed
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

/**
 * A unit's center only advances while no more than `UNIT_STRAGGLER_SHARE` of its soldiers are beyond reform distance of
 * their slot, so the block stays whole without one soldier caught on a rock or a friend halting everyone.
 * Soldiers whose slot is inside an obstacle don't count: they walk around it and rejoin once the slot comes out.
 * Only a halted unit moves blocked slots to the obstacle's edge; doing that on the march would crowd many slots onto
 * one short stretch of edge.
 */
function updateUnits(world: World): void {
  const obstacles = world.resource(Obstacles)
  const { sizes, stragglers, marching } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  sizes.clear()
  stragglers.clear()
  marching.clear()

  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    sizes.set(unit, (sizes.get(unit) ?? 0) + 1)
    const slot = soldierSlot(world, eid, unit)
    if (isBlocked(obstacles, slot.x, slot.z, SOLDIER_RADIUS)) continue
    const lag = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (lag > UNIT_REFORM_DISTANCE) stragglers.set(unit, (stragglers.get(unit) ?? 0) + 1)
  }

  const { center, destination } = units
  for (const unit of world.query(UNITS)) {
    const dx = destination.x.get(unit) - center.x.get(unit)
    const dz = destination.z.get(unit) - center.z.get(unit)
    const remaining = Math.hypot(dx, dz)
    if (remaining === 0) continue
    if ((stragglers.get(unit) ?? 0) <= (sizes.get(unit) ?? 0) * UNIT_STRAGGLER_SHARE) {
      const step = unitSpeed(world, unit) * world.time.deltaTime
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
    pushOutOfObstacles(obstacles, slot, SOLDIER_RADIUS)
    const drift = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (!world.has(eid, MoveTarget) && drift <= UNIT_DRIFT_DISTANCE) continue
    setMoveTarget(world, eid, slot, units.facing.get(unit))
  }
}

/**
 * Heading toward the target `(dx, dz)` away, bent past obstacles in the way so the soldier walks around them, not into
 * them. It passes the first on the side the target lies on, so with unflattened slots a formation parts around both
 * sides; any obstacle blocking the bent heading is passed by turning further the same way, so it never zigzags.
 */
function steer(obstacles: ObstacleField, x: number, z: number, dx: number, dz: number, distance: number): number {
  const count = findObstacles(obstacles, x, z, SOLDIER_RADIUS + STEER_LOOKAHEAD)
  let heading = Math.atan2(dx, dz)
  let turn = 0
  for (let pass = 0; pass < STEER_PASSES; pass++) {
    const forwardX = Math.sin(heading)
    const forwardZ = Math.cos(heading)
    let blocker = -1
    let nearest = Infinity
    let blockerSide = 0
    for (let i = 0; i < count; i++) {
      const obstacle = obstacles.found[i]
      const ox = obstacle.x - x
      const oz = obstacle.z - z
      const range = Math.hypot(ox, oz)
      const clearance = obstacle.radius + SOLDIER_RADIUS
      const side = forwardX * oz - forwardZ * ox
      const behind = ox * forwardX + oz * forwardZ <= 0
      if (behind || range - clearance > distance || Math.abs(side) >= clearance || range >= nearest) continue
      blocker = i
      nearest = range
      blockerSide = side
    }
    if (blocker === -1) break
    if (turn === 0) turn = blockerSide > 0 ? 1 : -1
    const obstacle = obstacles.found[blocker]
    const offset = Math.asin(Math.min((obstacle.radius + SOLDIER_RADIUS) / nearest, 1))
    heading = Math.atan2(obstacle.x - x, obstacle.z - z) + turn * offset
  }
  return heading
}

function moveSoldiers(world: World): void {
  const obstacles = world.resource(Obstacles)
  const maxTurn = SOLDIER_TURN_SPEED * world.time.deltaTime
  const { translation, rotation } = world.storage(Transform)
  const targets = world.storage(MoveTarget)
  const soldiers = world.storage(Soldier)

  for (const eid of world.query(MOVERS)) {
    const dx = targets.x.get(eid) - translation.x.get(eid)
    const dz = targets.z.get(eid) - translation.z.get(eid)
    const distance = Math.hypot(dx, dz)
    const pace = distance > UNIT_REFORM_DISTANCE ? SOLDIER_SPRINT : SOLDIER_CATCH_UP
    const step = unitSpeed(world, soldiers.unit.get(eid)) * pace * world.time.deltaTime
    if (distance <= ARRIVE_DISTANCE || distance <= step) {
      if (dx !== 0) translation.x.set(eid, targets.x.get(eid))
      if (dz !== 0) translation.z.set(eid, targets.z.get(eid))
      const facing = turnToward(rotation, eid, targets.heading.get(eid), maxTurn)
      if (facing && isIdle(world, soldiers.unit.get(eid))) world.remove(eid, MoveTarget)
      continue
    }
    const x = translation.x.get(eid)
    const z = translation.z.get(eid)
    const heading = steer(obstacles, x, z, dx, dz, distance)
    turnToward(rotation, eid, heading, maxTurn)
    translation.x.set(eid, x + Math.sin(heading) * step)
    translation.z.set(eid, z + Math.cos(heading) * step)
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
