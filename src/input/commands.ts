import { Devices, InputPlugin, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, System, World } from '@dylanebert/shallot'
import { DRAG_THRESHOLD_PX } from '../config'
import { MoveTarget, Soldier, Unit } from '../units/components'
import { assignSlots, planFrontage, planJoin, planMove, planSplit, slotToWorld } from '../units/formation'
import type { Placed, Point, UnitPlan, UnitPose } from '../units/formation'
import { UnitsPlugin } from '../units/units'
import { pickGround } from './ground'
import { ControlGroups, CTRL_KEYS, selectedCount, selectedUnits, setSelection, SelectionPlugin } from './selection'

const SOLDIERS = [Soldier]
const SPLIT_KEY = 'KeyX'
const JOIN_KEY = 'KeyC'

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

function unitPose(world: World, unit: number, count: number): UnitPose {
  const { center, facing, files } = world.storage(Unit)
  return { unit, x: center.x.get(unit), z: center.z.get(unit), facing: facing.get(unit), count, files: files.get(unit) }
}

function selectedPoses(world: World): UnitPose[] {
  const byUnit = soldiersByUnit(world, selectedUnits(world))
  return [...byUnit].map(([unit, soldiers]) => unitPose(world, unit, soldiers.length))
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

// Snaps unit centers to the plan so soldiers run straight to their new slots instead of the block marching there.
function reformInPlace(world: World, plans: readonly UnitPlan[]): void {
  issueOrders(world, plans)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const byUnit = new Map(plans.map((plan) => [plan.unit, plan]))
  for (const { unit, center } of plans) {
    units.center.x.set(unit, center.x)
    units.center.z.set(unit, center.z)
  }
  const target = { x: 0, z: 0 }
  for (const eid of world.query(SOLDIERS)) {
    const plan = byUnit.get(soldiers.unit.get(eid))
    if (!plan || world.has(eid, MoveTarget)) continue
    slotToWorld(plan.center, plan.facing, { x: soldiers.slotX.get(eid), z: soldiers.slotZ.get(eid) }, target)
    world.add(eid, MoveTarget, { ...target, heading: plan.facing })
  }
}

function editControlGroups(world: World, edit: (units: number[]) => number[]): void {
  const groups = world.resource(ControlGroups)
  for (const [key, units] of groups) groups.set(key, [...new Set(edit(units))])
}

// The right half becomes a new unit; both halves stay selected and in the original's control groups.
function splitSelected(world: World): void {
  const soldiers = world.storage(Soldier)
  const { type } = world.storage(Unit)
  const plans: UnitPlan[] = []
  const halves = new Map<number, number>()
  for (const [unit, members] of soldiersByUnit(world, selectedUnits(world))) {
    if (members.length < 2) continue
    const [left, right] = planSplit(unitPose(world, unit, members.length))
    const half = world.create()
    world.add(half, Unit, { type: type.get(unit) })
    const leftCount = left.layout.rows.reduce((sum, row) => sum + row.length, 0)
    members.sort((a, b) => soldiers.slotX.get(a.eid) - soldiers.slotX.get(b.eid))
    for (const { eid } of members.slice(leftCount)) soldiers.unit.set(eid, half)
    plans.push({ unit, ...left }, { unit: half, ...right })
    halves.set(unit, half)
  }
  reformInPlace(world, plans)
  editControlGroups(world, (units) =>
    units.flatMap((unit) => {
      const half = halves.get(unit)
      return half === undefined ? [unit] : [unit, half]
    }),
  )
  setSelection(world, halves.values(), true)
}

// Total War merges only units of the same type: per type, the largest selected unit absorbs the others, which are destroyed.
function joinSelected(world: World): void {
  const { type } = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const survivors = new Map<number, number>()
  const plans: UnitPlan[] = []
  for (const poses of Map.groupBy(selectedPoses(world), (pose) => type.get(pose.unit)).values()) {
    if (poses.length < 2) continue
    poses.sort((a, b) => b.count - a.count)
    const survivor = poses[0].unit
    for (const pose of poses.slice(1)) survivors.set(pose.unit, survivor)
    plans.push({ unit: survivor, ...planJoin(poses) })
  }
  if (plans.length === 0) return
  for (const eid of world.query(SOLDIERS)) {
    const survivor = survivors.get(soldiers.unit.get(eid))
    if (survivor !== undefined) soldiers.unit.set(eid, survivor)
  }
  for (const unit of survivors.keys()) world.destroy(unit)
  reformInPlace(world, plans)
  editControlGroups(world, (units) => units.map((unit) => survivors.get(unit) ?? unit))
}

function updateReorganize(world: World): void {
  const { keys } = world.resource(Devices)
  if (CTRL_KEYS.some((code) => keys.held.has(code))) return
  if (keys.pressed.has(SPLIT_KEY)) splitSelected(world)
  if (keys.pressed.has(JOIN_KEY)) joinSelected(world)
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
  update(world) {
    updateCommands(world)
    updateReorganize(world)
  },
}

export const CommandPlugin: Plugin = {
  name: 'RtsCommands',
  dependencies: [InputPlugin, UnitsPlugin, SelectionPlugin],
  systems: [CommandSystem],
}
