import { Devices, InputPlugin, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { DRAG_THRESHOLD_PX } from '../config'
import { Formation, FormationSlot } from '../units/components'
import { assignSlots, planLine, planSquare } from '../units/formation'
import type { FormationPlan, Placed, Point } from '../units/formation'
import { UnitsPlugin } from '../units/units'
import { pickGround } from './ground'
import { selectedCount, selectedUnits, SelectionPlugin } from './selection'

export interface CommandState {
  drag: { startX: number; startY: number; anchor: Point } | null
  /** Line formation shown while a right drag is past the drag threshold. */
  preview: FormationPlan | null
  /** Point of a move order issued without a drag; the marker consumer takes it and resets it to null. */
  ping: Point | null
}

export const Commands: Resource<CommandState> = {
  create: () => ({ drag: null, preview: null, ping: null }),
}

function placedSelection(world: World): Placed[] {
  const { translation } = world.storage(Transform)
  return selectedUnits(world).map((eid) => ({ eid, x: translation.x.get(eid), z: translation.z.get(eid) }))
}

function updatePreview(world: World, state: CommandState, x: number, y: number): void {
  const { drag } = state
  if (!drag) return
  if (!state.preview && Math.hypot(x - drag.startX, y - drag.startY) <= DRAG_THRESHOLD_PX) return
  const end = pickGround(world, x, y)
  if (end) state.preview = planLine(drag.anchor, end, selectedCount(world))
}

function cancelDrag(state: CommandState): void {
  state.drag = null
  state.preview = null
}

function issueMove(world: World, state: CommandState, anchor: Point): void {
  const units = placedSelection(world)
  if (units.length === 0) return
  const centroid = { x: 0, z: 0 }
  for (const unit of units) {
    centroid.x += unit.x / units.length
    centroid.z += unit.z / units.length
  }
  const plan = state.preview ?? planSquare(centroid, anchor, units.length)

  const formation = world.create()
  world.add(formation, Formation, {
    center: [centroid.x, 0, centroid.z],
    destination: [plan.center.x, 0, plan.center.z],
    facing: plan.facing,
  })
  for (const [eid, offset] of assignSlots(units, plan.layout, plan.facing)) {
    world.add(eid, FormationSlot, { formation, x: offset.x, z: offset.z })
  }
  if (!state.preview) state.ping = anchor
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
      issueMove(world, state, state.drag.anchor)
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
