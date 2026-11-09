import { Devices, InputPlugin, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { drawLine, Gizmo, GizmoAsset, LinesPlugin, registerGizmo } from '@dylanebert/shallot/extras'
import { worldToViewport } from '@dylanebert/shallot/rendering'
import { CLICK_SELECT_RADIUS_PX, DOUBLE_CLICK_MS, DRAG_THRESHOLD_PX, KEYS, SELECTION_RING, SOLDIER_CENTER_HEIGHT } from '../config'
import { RtsView, WorldPlugin } from '../scene/world'
import { Selected, Soldier, Unit } from '../units/components'
import { UnitsPlugin } from '../units/units'
import { anyKey } from './keys'

const UNITS = [Unit]
const SOLDIERS = [Soldier]
const SELECTED_UNITS = [Unit, Selected]
const DIGIT_CODE = /^Digit(\d)$/

export interface DragState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  dragging: boolean
  active: boolean
}

export const SelectionDrag: Resource<DragState> = {
  create: () => ({ startX: 0, startY: 0, currentX: 0, currentY: 0, dragging: false, active: false }),
}

const LastClick: Resource<{ unit: number; at: number }> = { create: () => ({ unit: -1, at: 0 }) }

export const ControlGroups: Resource<Map<string, number[]>> = { create: () => new Map() }

const point: [number, number, number] = [0, 0, 0]

const SelectionRing: Resource<number> = {
  create(world) {
    const { radius, lift, segments, color } = SELECTION_RING
    const ring = new GizmoAsset()
    const vertex = (i: number): [number, number, number] => {
      const angle = (i / segments) * Math.PI * 2
      return [Math.cos(angle) * radius, lift, Math.sin(angle) * radius]
    }
    for (let i = 0; i < segments; i++) drawLine(ring, vertex(i), vertex(i + 1), color)
    return registerGizmo(world, ring)
  },
}

export function selectedUnits(world: World): number[] {
  return Array.from(world.query(SELECTED_UNITS))
}

export function selectedCount(world: World): number {
  let count = 0
  for (const _ of world.query(SELECTED_UNITS)) count++
  return count
}

function syncRings(world: World): void {
  const handle = world.resource(SelectionRing)
  const soldiers = world.storage(Soldier)
  for (const eid of world.query(SOLDIERS)) {
    const selected = world.has(soldiers.unit.get(eid), Selected)
    if (selected === world.has(eid, Gizmo)) continue
    if (selected) world.add(eid, Gizmo, { handle, width: SELECTION_RING.width })
    else world.remove(eid, Gizmo)
  }
}

export function setSelection(world: World, units: Iterable<number>, additive: boolean): void {
  const next = new Set(units)
  for (const unit of world.query(UNITS)) {
    const wasSelected = world.has(unit, Selected)
    const isSelected = next.has(unit) || (additive && wasSelected)
    if (isSelected === wasSelected) continue
    if (isSelected) world.add(unit, Selected)
    else world.remove(unit, Selected)
  }
  syncRings(world)
}

function forEachSoldierOnScreen(world: World, visit: (unit: number, x: number, y: number) => void): void {
  const camera = world.resource(RtsView).camera
  const { translation } = world.storage(Transform)
  const soldiers = world.storage(Soldier)
  for (const eid of world.query(SOLDIERS)) {
    point[0] = translation.x.get(eid)
    point[1] = translation.y.get(eid) + SOLDIER_CENTER_HEIGHT
    point[2] = translation.z.get(eid)
    const screen = worldToViewport(world, camera, point)
    if (screen) visit(soldiers.unit.get(eid), screen[0], screen[1])
  }
}

function selectRect(world: World, drag: DragState, additive: boolean): void {
  const minX = Math.min(drag.startX, drag.currentX)
  const maxX = Math.max(drag.startX, drag.currentX)
  const minY = Math.min(drag.startY, drag.currentY)
  const maxY = Math.max(drag.startY, drag.currentY)
  const units = new Set<number>()
  forEachSoldierOnScreen(world, (unit, x, y) => {
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) units.add(unit)
  })
  setSelection(world, units, additive)
}

function selectClick(world: World, drag: DragState, additive: boolean): void {
  let nearest = -1
  let nearestDistance = CLICK_SELECT_RADIUS_PX
  forEachSoldierOnScreen(world, (unit, x, y) => {
    const distance = Math.hypot(x - drag.currentX, y - drag.currentY)
    if (distance > nearestDistance) return
    nearestDistance = distance
    nearest = unit
  })
  const last = world.resource(LastClick)
  const now = world.time.realElapsed * 1000
  const double = nearest >= 0 && nearest === last.unit && now - last.at <= DOUBLE_CLICK_MS
  last.unit = double ? -1 : nearest
  last.at = now
  if (double) setSelection(world, unitsOfType(world, world.storage(Unit).type.get(nearest)), additive)
  else if (nearest >= 0) setSelection(world, [nearest], additive)
  else if (!additive) setSelection(world, [], false)
}

function unitsOfType(world: World, type: number): number[] {
  const units = world.storage(Unit)
  return Array.from(world.query(UNITS)).filter((unit) => units.type.get(unit) === type)
}

function moveDrag(drag: DragState, x: number, y: number): void {
  drag.currentX = x
  drag.currentY = y
  if (!drag.dragging && Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD_PX) drag.dragging = true
}

function endDrag(drag: DragState): void {
  drag.active = false
  drag.dragging = false
}

function updateDrag(world: World): void {
  const { pointer, keys } = world.resource(Devices)
  const drag = world.resource(SelectionDrag)

  for (const event of pointer.buttonEvents) {
    if (event.button !== 'left') continue
    if (event.pressed) {
      if (drag.active || pointer.middle) continue
      drag.startX = drag.currentX = event.x
      drag.startY = drag.currentY = event.y
      drag.dragging = false
      drag.active = true
    } else if (drag.active) {
      moveDrag(drag, event.x, event.y)
      const additive = anyKey(keys.held, KEYS.shift)
      if (drag.dragging) selectRect(world, drag, additive)
      else selectClick(world, drag, additive)
      endDrag(drag)
    }
  }

  if (!drag.active) return
  if (pointer.left) moveDrag(drag, pointer.x, pointer.y)
  else endDrag(drag)
}

function updateGroups(world: World): void {
  const { keys } = world.resource(Devices)
  const groups = world.resource(ControlGroups)
  const assign = anyKey(keys.held, KEYS.ctrl)
  const additive = anyKey(keys.held, KEYS.shift)
  if (assign && anyKey(keys.pressed, KEYS.selectAll)) setSelection(world, world.query(UNITS), false)
  for (const code of keys.pressed) {
    const key = DIGIT_CODE.exec(code)?.[1]
    if (key === undefined) continue
    if (assign) {
      const units = selectedUnits(world)
      if (units.length > 0) groups.set(key, units)
      else groups.delete(key)
    } else {
      const units = groups.get(key)
      if (units) setSelection(world, units, additive)
    }
  }
}

const SelectionSystem: System = {
  name: 'selection',
  group: 'setup',
  update(world) {
    updateDrag(world)
    updateGroups(world)
  },
}

export const SelectionPlugin: Plugin = {
  name: 'RtsSelection',
  dependencies: [InputPlugin, LinesPlugin, WorldPlugin, UnitsPlugin],
  systems: [SelectionSystem],
}
