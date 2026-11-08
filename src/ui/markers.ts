import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { drawLine, LinesPlugin } from '@dylanebert/shallot/extras'
import { Commands, CommandPlugin } from '../input/commands'
import { Selected, Unit } from '../units/components'
import { footprint, slotToWorld } from '../units/formation'
import type { Point, SlotOffset } from '../units/formation'

const LIFT = 0.05
const MARKER_COLOR = 0xffe666
const GROUND_COLOR = 0x476642
const LINE_WIDTH = 2
const ARROW_BASE = 0.6
const ARROW_TIP = 1.8
const ARROW_HALF_WIDTH = 1.2
const RING_SECONDS = 0.5
const RING_SEGMENTS = 32
const RING_START_RADIUS = 0.5
const RING_END_RADIUS = 1.5
const LINE = { width: LINE_WIDTH }

interface Ring {
  point: Point
  elapsed: number
}

const MoveRing: Resource<{ ring: Ring | null }> = { create: () => ({ ring: null }) }

const SELECTED_UNITS = [Unit, Selected]
const cornerPoint: Point = { x: 0, z: 0 }
const cornerOffset: SlotOffset = { x: 0, z: 0 }
const corners: [number, number, number][] = Array.from({ length: 4 }, () => [0, LIFT, 0])
const arrow: [number, number, number][] = Array.from({ length: 3 }, () => [0, LIFT, 0])
const destination: Point = { x: 0, z: 0 }

function setCorner(corner: [number, number, number], center: Point, facing: number, x: number, z: number): void {
  cornerOffset.x = x
  cornerOffset.z = z
  slotToWorld(center, facing, cornerOffset, cornerPoint)
  corner[0] = cornerPoint.x
  corner[2] = cornerPoint.z
}

function drawFootprint(world: World, center: Point, facing: number, files: number, ranks: number): void {
  const { halfWidth, front, back } = footprint(files, ranks)
  setCorner(corners[0], center, facing, -halfWidth, front)
  setCorner(corners[1], center, facing, halfWidth, front)
  setCorner(corners[2], center, facing, halfWidth, back)
  setCorner(corners[3], center, facing, -halfWidth, back)
  for (let i = 0; i < 4; i++) drawLine(world, corners[i], corners[(i + 1) % 4], MARKER_COLOR, LINE)
  setCorner(arrow[0], center, facing, -ARROW_HALF_WIDTH, front + ARROW_BASE)
  setCorner(arrow[1], center, facing, 0, front + ARROW_TIP)
  setCorner(arrow[2], center, facing, ARROW_HALF_WIDTH, front + ARROW_BASE)
  drawLine(world, arrow[0], arrow[1], MARKER_COLOR, LINE)
  drawLine(world, arrow[1], arrow[2], MARKER_COLOR, LINE)
}

function drawDestinations(world: World): void {
  const units = world.storage(Unit)
  for (const unit of world.query(SELECTED_UNITS)) {
    destination.x = units.destination.x.get(unit)
    destination.z = units.destination.z.get(unit)
    if (destination.x === units.center.x.get(unit) && destination.z === units.center.z.get(unit)) continue
    drawFootprint(world, destination, units.facing.get(unit), units.files.get(unit), units.ranks.get(unit))
  }
}

function drawPreview(world: World): void {
  const { preview } = world.resource(Commands)
  if (!preview) return
  for (const { layout, center, facing } of preview) {
    drawFootprint(world, center, facing, layout.rows[0].length, layout.rows.length)
  }
}

const ringStart: [number, number, number] = [0, LIFT, 0]
const ringEnd: [number, number, number] = [0, LIFT, 0]

function lerpChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t)
}

function fadedColor(t: number): number {
  const r = lerpChannel(MARKER_COLOR >> 16, GROUND_COLOR >> 16, t)
  const g = lerpChannel((MARKER_COLOR >> 8) & 0xff, (GROUND_COLOR >> 8) & 0xff, t)
  const b = lerpChannel(MARKER_COLOR & 0xff, GROUND_COLOR & 0xff, t)
  return (r << 16) | (g << 8) | b
}

function drawRing(world: World, ring: Ring): void {
  const t = ring.elapsed / RING_SECONDS
  const radius = RING_START_RADIUS + (RING_END_RADIUS - RING_START_RADIUS) * t
  const color = fadedColor(t)
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a0 = (i / RING_SEGMENTS) * Math.PI * 2
    const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2
    ringStart[0] = ring.point.x + Math.cos(a0) * radius
    ringStart[2] = ring.point.z + Math.sin(a0) * radius
    ringEnd[0] = ring.point.x + Math.cos(a1) * radius
    ringEnd[2] = ring.point.z + Math.sin(a1) * radius
    drawLine(world, ringStart, ringEnd, color, LINE)
  }
}

function drawMoveRing(world: World): void {
  const commands = world.resource(Commands)
  const state = world.resource(MoveRing)
  if (commands.ping) {
    state.ring = { point: commands.ping, elapsed: 0 }
    commands.ping = null
  }
  const { ring } = state
  if (!ring) return
  ring.elapsed += world.time.deltaTime
  if (ring.elapsed >= RING_SECONDS) {
    state.ring = null
    return
  }
  drawRing(world, ring)
}

const MarkersSystem: System = {
  name: 'markers',
  group: 'simulation',
  update(world) {
    drawDestinations(world)
    drawPreview(world)
    drawMoveRing(world)
  },
}

export const MarkersPlugin: Plugin = {
  name: 'RtsMarkers',
  dependencies: [LinesPlugin, CommandPlugin],
  systems: [MarkersSystem],
}
