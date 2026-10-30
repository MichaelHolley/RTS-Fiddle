import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { drawLine, LinesPlugin } from '@dylanebert/shallot/extras'
import { Commands, CommandPlugin } from '../input/commands'
import { Formation, FormationSlot } from '../units/components'
import { slotToWorld } from '../units/formation'
import type { Point, SlotOffset } from '../units/formation'

const LIFT = 0.05
const MARKER_COLOR = 0xffe666
const GROUND_COLOR = 0x476642
const LINE_WIDTH = 2
const MARKER_TIP = 0.35
const MARKER_BACK = 0.2
const MARKER_HALF_WIDTH = 0.25
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

const MARKED = [FormationSlot]
const slotPoint: Point = { x: 0, z: 0 }
const cornerOffset: SlotOffset = { x: 0, z: 0 }
const tip: [number, number, number] = [0, LIFT, 0]
const left: [number, number, number] = [0, LIFT, 0]
const right: [number, number, number] = [0, LIFT, 0]

function setCorner(corner: [number, number, number], center: Point, facing: number, x: number, z: number): void {
  cornerOffset.x = x
  cornerOffset.z = z
  slotToWorld(center, facing, cornerOffset, slotPoint)
  corner[0] = slotPoint.x
  corner[2] = slotPoint.z
}

function drawSlotMarker(world: World, center: Point, facing: number, { x, z }: SlotOffset): void {
  setCorner(tip, center, facing, x, z + MARKER_TIP)
  setCorner(left, center, facing, x - MARKER_HALF_WIDTH, z - MARKER_BACK)
  setCorner(right, center, facing, x + MARKER_HALF_WIDTH, z - MARKER_BACK)
  drawLine(world, tip, right, MARKER_COLOR, LINE)
  drawLine(world, right, left, MARKER_COLOR, LINE)
  drawLine(world, left, tip, MARKER_COLOR, LINE)
}

function drawFormationMarkers(world: World): void {
  const slots = world.storage(FormationSlot)
  const formations = world.storage(Formation)
  const center: Point = { x: 0, z: 0 }
  const offset: SlotOffset = { x: 0, z: 0 }
  for (const eid of world.query(MARKED)) {
    const formation = slots.formation.get(eid)
    if (formation === 0) continue
    center.x = formations.destination.x.get(formation)
    center.z = formations.destination.z.get(formation)
    offset.x = slots.x.get(eid)
    offset.z = slots.z.get(eid)
    drawSlotMarker(world, center, formations.facing.get(formation), offset)
  }
}

function drawPreview(world: World): void {
  const { preview } = world.resource(Commands)
  if (!preview) return
  for (const row of preview.layout.rows) {
    for (const slot of row) drawSlotMarker(world, preview.center, preview.facing, slot)
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
    drawFormationMarkers(world)
    drawPreview(world)
    drawMoveRing(world)
  },
}

export const MarkersPlugin: Plugin = {
  name: 'RtsMarkers',
  dependencies: [LinesPlugin, CommandPlugin],
  systems: [MarkersSystem],
}
