import { Devices, InputPlugin, MeshMaterial, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { worldToViewport } from '@dylanebert/shallot/rendering'
import { CLICK_SELECT_RADIUS_PX, DRAG_THRESHOLD_PX } from '../config'
import { RtsView, WorldPlugin } from '../scene/world'
import { Selected, Unit } from '../units/components'
import { UnitMaterials, UnitsPlugin } from '../units/units'

const UNITS = [Unit]
const SELECTED_UNITS = [Unit, Selected]
const DIGIT_CODE = /^Digit(\d)$/
const SHIFT_KEYS = ['ShiftLeft', 'ShiftRight']
const CTRL_KEYS = ['ControlLeft', 'ControlRight']

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

export const ControlGroups: Resource<Map<string, number[]>> = { create: () => new Map() }

const point: [number, number, number] = [0, 0, 0]

export function selectedUnits(world: World): number[] {
  return Array.from(world.query(SELECTED_UNITS))
}

export function selectedCount(world: World): number {
  let count = 0
  for (const _ of world.query(SELECTED_UNITS)) count++
  return count
}

export function setSelection(world: World, eids: Iterable<number>, additive: boolean): void {
  const next = new Set(eids)
  const { idle, selected } = world.resource(UnitMaterials)
  const material = world.storage(MeshMaterial).material
  for (const eid of world.query(UNITS)) {
    const wasSelected = world.has(eid, Selected)
    const isSelected = next.has(eid) || (additive && wasSelected)
    if (isSelected === wasSelected) continue
    if (isSelected) world.add(eid, Selected)
    else world.remove(eid, Selected)
    material.set(eid, (isSelected ? selected : idle).material)
  }
}

function forEachScreenPosition(world: World, visit: (eid: number, x: number, y: number) => void): void {
  const camera = world.resource(RtsView).camera
  const { translation } = world.storage(Transform)
  for (const eid of world.query(UNITS)) {
    point[0] = translation.x.get(eid)
    point[1] = translation.y.get(eid)
    point[2] = translation.z.get(eid)
    const screen = worldToViewport(world, camera, point)
    if (screen) visit(eid, screen[0], screen[1])
  }
}

function selectRect(world: World, drag: DragState, additive: boolean): void {
  const minX = Math.min(drag.startX, drag.currentX)
  const maxX = Math.max(drag.startX, drag.currentX)
  const minY = Math.min(drag.startY, drag.currentY)
  const maxY = Math.max(drag.startY, drag.currentY)
  const eids: number[] = []
  forEachScreenPosition(world, (eid, x, y) => {
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) eids.push(eid)
  })
  setSelection(world, eids, additive)
}

function selectClick(world: World, drag: DragState, additive: boolean): void {
  let nearest = -1
  let nearestDistance = CLICK_SELECT_RADIUS_PX
  forEachScreenPosition(world, (eid, x, y) => {
    const distance = Math.hypot(x - drag.currentX, y - drag.currentY)
    if (distance > nearestDistance) return
    nearestDistance = distance
    nearest = eid
  })
  if (nearest >= 0) setSelection(world, [nearest], additive)
  else if (!additive) setSelection(world, [], false)
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
      const additive = SHIFT_KEYS.some((code) => keys.held.has(code))
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
  const assign = CTRL_KEYS.some((code) => keys.held.has(code))
  const additive = SHIFT_KEYS.some((code) => keys.held.has(code))
  for (const code of keys.pressed) {
    const key = DIGIT_CODE.exec(code)?.[1]
    if (key === undefined) continue
    if (assign) {
      const eids = selectedUnits(world)
      if (eids.length > 0) groups.set(key, eids)
      else groups.delete(key)
    } else {
      const eids = groups.get(key)
      if (eids) setSelection(world, eids, additive)
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
  dependencies: [InputPlugin, WorldPlugin, UnitsPlugin],
  systems: [SelectionSystem],
}
