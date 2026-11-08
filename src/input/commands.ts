import { Devices, InputPlugin, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { DRAG_THRESHOLD_PX } from '../config'
import { Soldier, Unit } from '../units/components'
import { assignSlots, planFrontage, planMove } from '../units/formation'
import type { Placed, Point, UnitPlan, UnitPose } from '../units/formation'
import { UnitsPlugin } from '../units/units'
import { pickGround } from './ground'
import { selectedCount, selectedUnits, SelectionPlugin } from './selection'

const SOLDIERS = [Soldier]

export interface CommandState {
  drag: { startX: number; startY: number; anchor: Point } | null
  /** Frontage plans shown while a right drag is past the drag threshold. */
  preview: UnitPlan[] | null
  /** Point of a move order issued without a drag; the marker consumer takes it and resets it to null. */
  ping: Point | null
}

export const Commands: Resource<CommandState> = {
  create: () => ({ drag: null, preview: null, ping: null }),
}

function soldiersByUnit(world: World, units: readonly number[]): Map<number, Placed[]> {
  const byUnit = new Map(units.map((unit) => [unit, [] as Placed[]]))
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  for (const eid of world.query(SOLDIERS)) {
    byUnit.get(soldiers.unit.get(eid))?.push({ eid, x: translation.x.get(eid), z: translation.z.get(eid) })
  }
  return byUnit
}

function selectedPoses(world: World): UnitPose[] {
  const { center, facing, files } = world.storage(Unit)
  const byUnit = soldiersByUnit(world, selectedUnits(world))
  return [...byUnit].map(([unit, soldiers]) => ({
    unit,
    x: center.x.get(unit),
    z: center.z.get(unit),
    facing: facing.get(unit),
    count: soldiers.length,
    files: files.get(unit),
  }))
}

function updatePreview(world: World, state: CommandState, x: number, y: number): void {
  const { drag } = state
  if (!drag) return
  if (!state.preview && Math.hypot(x - drag.startX, y - drag.startY) <= DRAG_THRESHOLD_PX) return
  const end = pickGround(world, x, y)
  if (end) state.preview = planFrontage(drag.anchor, end, selectedPoses(world))
}

function cancelDrag(state: CommandState): void {
  state.drag = null
  state.preview = null
}

function issueOrders(world: World, plans: readonly UnitPlan[]): void {
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const byUnit = soldiersByUnit(world, plans.map((plan) => plan.unit))
  for (const { unit, layout, center, facing } of plans) {
    units.destination.x.set(unit, center.x)
    units.destination.z.set(unit, center.z)
    units.facing.set(unit, facing)
    units.files.set(unit, layout.rows[0].length)
    units.ranks.set(unit, layout.rows.length)
    for (const [eid, slot] of assignSlots(byUnit.get(unit) ?? [], layout, facing)) {
      soldiers.slotX.set(eid, slot.x)
      soldiers.slotZ.set(eid, slot.z)
    }
  }
}

function updateCommands(world: World): void {
  const { pointer } = world.resource(Devices)
  const state = world.resource(Commands)

  for (const event of pointer.buttonEvents) {
    if (event.button !== 'right') continue
    if (event.pressed) {
      if (state.drag || pointer.middle || selectedCount(world) === 0) continue
      const anchor = pickGround(world, event.x, event.y)
      if (anchor) state.drag = { startX: event.x, startY: event.y, anchor }
    } else if (state.drag) {
      updatePreview(world, state, event.x, event.y)
      const { anchor } = state.drag
      if (state.preview) {
        issueOrders(world, state.preview)
      } else {
        issueOrders(world, planMove(anchor, selectedPoses(world)))
        state.ping = anchor
      }
      cancelDrag(state)
    }
  }

  if (!state.drag) return
  if (pointer.right) updatePreview(world, state, pointer.x, pointer.y)
  else cancelDrag(state)
}

const CommandSystem: System = {
  name: 'commands',
  group: 'setup',
  update: updateCommands,
}

export const CommandPlugin: Plugin = {
  name: 'RtsCommands',
  dependencies: [InputPlugin, UnitsPlugin, SelectionPlugin],
  systems: [CommandSystem],
}
