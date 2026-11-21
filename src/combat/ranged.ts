import { Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import { FACTIONS, LASER_BOLT, LASER_MISS_SPREAD, SOLDIER_CENTER_HEIGHT, UNIT_TYPES } from '../config'
import type { FactionId, RangedStats, UnitTypeId } from '../config'
import { AttackOrder, Combatant, MoveTarget, Soldier, Unit } from '../units/components'
import { MoveSystem, UnitScratch } from '../units/movement'
import { BoltSystem, launchBolt } from './bolts'
import type { Vec3 } from './bolts'
import { cooldownAfter, Melee } from './engagement'

const UNITS = [Unit]
const SOLDIERS = [Soldier, Combatant]

const RangedScratch: Resource<{ members: Map<number, number[]>; targets: Map<number, number> }> = {
  create: () => ({ members: new Map(), targets: new Map() }),
}

const muzzle: Vec3 = [0, 0, 0]
const aim: Vec3 = [0, 0, 0]

function groupMembers(world: World, members: Map<number, number[]>): void {
  for (const list of members.values()) list.length = 0
  const soldiers = world.storage(Soldier)
  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    const list = members.get(unit)
    if (list) list.push(eid)
    else members.set(unit, [eid])
  }
  for (const [unit, list] of members) if (list.length === 0) members.delete(unit)
}

function rangedStats(world: World, unit: number): RangedStats | undefined {
  return UNIT_TYPES[world.storage(Unit).type.get(unit) as UnitTypeId].ranged
}

// Total War infantry only fire standing still: at their attack order's target, otherwise the nearest enemy unit in range.
function pickTargets(world: World, targets: Map<number, number>): void {
  targets.clear()
  const { marching } = world.resource(UnitScratch)
  const { center, faction } = world.storage(Unit)
  const orders = world.storage(AttackOrder)
  const all = Array.from(world.query(UNITS))
  const distanceBetween = (a: number, b: number): number =>
    Math.hypot(center.x.get(b) - center.x.get(a), center.z.get(b) - center.z.get(a))
  for (const unit of all) {
    const ranged = rangedStats(world, unit)
    if (!ranged || marching.has(unit)) continue
    const ordered = world.has(unit, AttackOrder) ? orders.target.get(unit) : 0
    if (ordered !== 0) {
      if (world.has(ordered, Unit) && distanceBetween(unit, ordered) <= ranged.range) targets.set(unit, ordered)
      continue
    }
    let nearest = ranged.range
    for (const other of all) {
      if (faction.get(other) === faction.get(unit)) continue
      const distance = distanceBetween(unit, other)
      if (distance > nearest) continue
      nearest = distance
      targets.set(unit, other)
    }
  }
}

function faceTarget(world: World, eid: number, x: number, z: number, heading: number): void {
  if (world.has(eid, MoveTarget)) world.storage(MoveTarget).heading.set(eid, heading)
  else world.add(eid, MoveTarget, { x, z, heading })
}

function shoot(world: World, eid: number, target: number, ranged: RangedStats, faction: FactionId): boolean {
  const { translation } = world.storage(Transform)
  const x = translation.x.get(eid)
  const z = translation.z.get(eid)
  const tx = translation.x.get(target)
  const tz = translation.z.get(target)
  if (Math.hypot(tx - x, tz - z) > ranged.range) return false
  const hit = Math.random() < ranged.accuracy
  const spread = hit ? 0 : LASER_MISS_SPREAD
  const angle = Math.random() * Math.PI * 2
  muzzle[0] = x
  muzzle[1] = translation.y.get(eid) + LASER_BOLT.muzzleHeight
  muzzle[2] = z
  aim[0] = tx + Math.cos(angle) * spread
  aim[1] = translation.y.get(target) + SOLDIER_CENTER_HEIGHT
  aim[2] = tz + Math.sin(angle) * spread
  launchBolt(world, muzzle, aim, hit ? world.ref(target) : 0, ranged.damage, FACTIONS[faction].laserColor)
  faceTarget(world, eid, x, z, Math.atan2(tx - x, tz - z))
  return true
}

/** Each ready soldier of a halted ranged unit fires at a random soldier of its unit's target, if that one is in range. */
function fire(world: World): void {
  const { members, targets } = world.resource(RangedScratch)
  const { fighting } = world.resource(Melee)
  const { faction } = world.storage(Unit)
  const { cooldown } = world.storage(Combatant)
  groupMembers(world, members)
  pickTargets(world, targets)
  for (const [unit, enemy] of targets) {
    const ranged = rangedStats(world, unit)!
    const victims = members.get(enemy)
    if (!victims) continue
    for (const eid of members.get(unit) ?? []) {
      if (cooldown.get(eid) > 0 || fighting.has(eid)) continue
      const victim = victims[Math.floor(Math.random() * victims.length)]
      if (shoot(world, eid, victim, ranged, faction.get(unit) as FactionId)) {
        cooldown.set(eid, cooldownAfter(ranged.interval))
      }
    }
  }
}

export const RangedSystem: System = {
  name: 'ranged',
  group: 'fixed',
  after: [BoltSystem],
  before: [MoveSystem],
  update: fire,
}
