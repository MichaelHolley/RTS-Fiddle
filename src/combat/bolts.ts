import type { EntityRef, Resource, System, World } from '@dylanebert/shallot'
import { drawLine } from '@dylanebert/shallot/extras'
import { LASER_BOLT } from '../config'
import { Combatant } from '../units/components'
import { MoveSystem } from '../units/movement'
import { EngagementSystem } from './engagement'

export type Vec3 = [number, number, number]

/** A laser bolt flying a straight line; `target` is the soldier it hits on arrival, or 0 for a miss. */
interface Bolt {
  from: Vec3
  direction: Vec3
  distance: number
  travelled: number
  target: EntityRef | 0
  damage: number
  color: number
}

const Bolts: Resource<Bolt[]> = { create: () => [] }

const LINE = { width: LASER_BOLT.width }
const head: Vec3 = [0, 0, 0]
const tail: Vec3 = [0, 0, 0]

export function launchBolt(world: World, from: Vec3, to: Vec3, target: EntityRef | 0, damage: number, color: number): void {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const distance = Math.hypot(dx, dy, dz)
  if (distance === 0) return
  const direction: Vec3 = [dx / distance, dy / distance, dz / distance]
  world.resource(Bolts).push({ from: [...from], direction, distance, travelled: 0, target, damage, color })
}

// Damage lands when the bolt arrives, so a soldier dies as the bolt reaches it; a target already dead takes nothing.
function advanceBolts(world: World): void {
  const bolts = world.resource(Bolts)
  const step = LASER_BOLT.speed * world.time.deltaTime
  const { health } = world.storage(Combatant)
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i]
    bolt.travelled += step
    if (bolt.travelled < bolt.distance) continue
    const target = bolt.target === 0 ? 0 : world.resolve(bolt.target)
    if (target !== 0 && world.has(target, Combatant)) health.set(target, health.get(target) - bolt.damage)
    bolts[i] = bolts[bolts.length - 1]
    bolts.pop()
  }
}

function pointAlong(bolt: Bolt, along: number, out: Vec3): void {
  for (let axis = 0; axis < 3; axis++) out[axis] = bolt.from[axis] + bolt.direction[axis] * along
}

function drawBolts(world: World): void {
  for (const bolt of world.resource(Bolts)) {
    const front = Math.min(bolt.travelled, bolt.distance)
    pointAlong(bolt, front, head)
    pointAlong(bolt, Math.max(front - LASER_BOLT.length, 0), tail)
    drawLine(world, tail, head, bolt.color, LINE)
  }
}

export const BoltSystem: System = {
  name: 'bolts',
  group: 'fixed',
  after: [EngagementSystem],
  before: [MoveSystem],
  update: advanceBolts,
}

export const BoltDrawSystem: System = {
  name: 'boltDraw',
  group: 'simulation',
  update: drawBolts,
}
