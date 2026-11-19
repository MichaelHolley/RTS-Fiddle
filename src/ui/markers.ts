import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { drawLine, LinesPlugin } from '@dylanebert/shallot/extras'
import { UNIT_TYPES } from '../config'
import type { UnitTypeId } from '../config'
import { Commands, CommandPlugin } from '../input/commands'
import { Terrain, terrainHeight } from '../terrain/heightmap'
import type { Heightmap } from '../terrain/heightmap'
import { Selected, Unit } from '../units/components'
import { footprint, slotToWorld } from '../units/formation'
import type { Point, SlotOffset } from '../units/formation'

const LIFT = 0.15
/** Longest straight piece of a marker line, so lines follow the ground over hills. */
const SEGMENT_LENGTH = 2
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
/** How far the range circle's color fades from `MARKER_COLOR` toward the ground, so it reads as a hint, not an order. */
const RANGE_FADE = 0.6
const RANGE_LINE = { width: 1 }

interface Ring {
  point: Point
  elapsed: number
}

const MoveRing: Resource<{ ring: Ring | null }> = { create: () => ({ ring: null }) }

const SELECTED_UNITS = [Unit, Selected]
const cornerPoint: Point = { x: 0, z: 0 }
const cornerOffset: SlotOffset = { x: 0, z: 0 }
const corners: Point[] = Array.from({ length: 4 }, () => ({ x: 0, z: 0 }))
const arrow: Point[] = Array.from({ length: 3 }, () => ({ x: 0, z: 0 }))
const destination: Point = { x: 0, z: 0 }
const rangeCenter: Point = { x: 0, z: 0 }
const segmentStart: [number, number, number] = [0, 0, 0]
const segmentEnd: [number, number, number] = [0, 0, 0]

function setCorner(corner: Point, center: Point, facing: number, x: number, z: number): void {
  cornerOffset.x = x
  cornerOffset.z = z
  slotToWorld(center, facing, cornerOffset, cornerPoint)
  corner.x = cornerPoint.x
  corner.z = cornerPoint.z
}

function groundPoint(map: Heightmap, x: number, z: number, out: [number, number, number]): void {
  out[0] = x
  out[1] = terrainHeight(map, x, z) + LIFT
  out[2] = z
}

function drawGroundLine(world: World, from: Point, to: Point, color: number): void {
  const map = world.resource(Terrain)
  const pieces = Math.max(Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / SEGMENT_LENGTH), 1)
  groundPoint(map, from.x, from.z, segmentEnd)
  for (let i = 1; i <= pieces; i++) {
    segmentStart[0] = segmentEnd[0]
    segmentStart[1] = segmentEnd[1]
    segmentStart[2] = segmentEnd[2]
    const t = i / pieces
    groundPoint(map, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, segmentEnd)
    drawLine(world, segmentStart, segmentEnd, color, LINE)
  }
}

function drawFootprint(world: World, center: Point, facing: number, files: number, ranks: number): void {
  const { halfWidth, front, back } = footprint(files, ranks)
  setCorner(corners[0], center, facing, -halfWidth, front)
  setCorner(corners[1], center, facing, halfWidth, front)
  setCorner(corners[2], center, facing, halfWidth, back)
  setCorner(corners[3], center, facing, -halfWidth, back)
  for (let i = 0; i < 4; i++) drawGroundLine(world, corners[i], corners[(i + 1) % 4], MARKER_COLOR)
  setCorner(arrow[0], center, facing, -ARROW_HALF_WIDTH, front + ARROW_BASE)
  setCorner(arrow[1], center, facing, 0, front + ARROW_TIP)
  setCorner(arrow[2], center, facing, ARROW_HALF_WIDTH, front + ARROW_BASE)
  drawGroundLine(world, arrow[0], arrow[1], MARKER_COLOR)
  drawGroundLine(world, arrow[1], arrow[2], MARKER_COLOR)
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


function lerpChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t)
}

function fadedColor(t: number): number {
  const r = lerpChannel(MARKER_COLOR >> 16, GROUND_COLOR >> 16, t)
  const g = lerpChannel((MARKER_COLOR >> 8) & 0xff, (GROUND_COLOR >> 8) & 0xff, t)
  const b = lerpChannel(MARKER_COLOR & 0xff, GROUND_COLOR & 0xff, t)
  return (r << 16) | (g << 8) | b
}

function drawGroundCircle(
  world: World,
  center: Point,
  radius: number,
  segments: number,
  color: number,
  line: { width: number },
): void {
  const map = world.resource(Terrain)
  const { x, z } = center
  groundPoint(map, x + radius, z, segmentEnd)
  for (let i = 1; i <= segments; i++) {
    segmentStart[0] = segmentEnd[0]
    segmentStart[1] = segmentEnd[1]
    segmentStart[2] = segmentEnd[2]
    const angle = (i / segments) * Math.PI * 2
    groundPoint(map, x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, segmentEnd)
    drawLine(world, segmentStart, segmentEnd, color, line)
  }
}

function drawRing(world: World, ring: Ring): void {
  const t = ring.elapsed / RING_SECONDS
  const radius = RING_START_RADIUS + (RING_END_RADIUS - RING_START_RADIUS) * t
  drawGroundCircle(world, ring.point, radius, RING_SEGMENTS, fadedColor(t), LINE)
}

// Units fire all around, not in a forward arc, so the range is a full circle around the unit's center.
function drawRanges(world: World): void {
  const units = world.storage(Unit)
  const color = fadedColor(RANGE_FADE)
  for (const unit of world.query(SELECTED_UNITS)) {
    const ranged = UNIT_TYPES[units.type.get(unit) as UnitTypeId].ranged
    if (!ranged) continue
    rangeCenter.x = units.center.x.get(unit)
    rangeCenter.z = units.center.z.get(unit)
    const segments = Math.ceil((Math.PI * 2 * ranged.range) / SEGMENT_LENGTH)
    drawGroundCircle(world, rangeCenter, ranged.range, segments, color, RANGE_LINE)
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
    drawRanges(world)
    drawPreview(world)
    drawMoveRing(world)
  },
}

export const MarkersPlugin: Plugin = {
  name: 'RtsMarkers',
  dependencies: [LinesPlugin, CommandPlugin],
  systems: [MarkersSystem],
}
