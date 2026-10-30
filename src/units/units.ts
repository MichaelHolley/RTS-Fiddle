import {
  capsule,
  cube,
  Materials,
  Meshes,
  MeshInstance,
  MeshMaterial,
  StandardMaterial,
  Transform,
} from '@dylanebert/shallot'
import type { MeshHandle, Plugin, Resource, System, Vector4Field, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import {
  FORMATION_REFORM_DISTANCE,
  FORMATION_SPACING,
  FORMATION_SPEED,
  MAP_SIZE,
  UNIT_COUNT,
  UNIT_RADIUS,
  UNIT_SPEED,
} from '../config'
import { linearHex } from '../scene/color'
import { mergeMeshes } from '../scene/meshes'
import { Formation, FormationSlot, MoveTarget, Selected, Unit } from './components'
import { slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'

const UNIT_HEIGHT = 1.8
const UNIT_Y = UNIT_HEIGHT / 2
const ARRIVE_DISTANCE = 0.1
const SETTLE_DISTANCE = 0.2
const MIN_SEPARATION = UNIT_RADIUS * 2
const GRID_COLUMNS = Math.ceil(MAP_SIZE / MIN_SEPARATION)
const GRID_HALF_SIZE = MAP_SIZE / 2

const UNITS = [Unit]
const MEMBERS = [Unit, FormationSlot]
const MOVERS = [Unit, MoveTarget]
const FORMATIONS = [Formation]

export const UnitMaterials: Resource<{ idle: MaterialHandle; selected: MaterialHandle }> = {
  create(world) {
    const materials = world.resource(Materials)
    const material = (hex: number): MaterialHandle =>
      materials.add(StandardMaterial({ baseColor: linearHex(hex), perceptualRoughness: 0.9 }))
    return { idle: material(0xdddddd), selected: material(0x44ff66) }
  },
}

interface FormationState {
  lag: number
  heading: number
  active: boolean
}

const FormationScratch: Resource<{
  states: Map<number, FormationState>
  center: Point
  offset: SlotOffset
  slot: Point
}> = {
  create: () => ({
    states: new Map(),
    center: { x: 0, z: 0 },
    offset: { x: 0, z: 0 },
    slot: { x: 0, z: 0 },
  }),
}

const SeparationGrid: Resource<{
  cellHead: Int32Array
  nextInCell: Int32Array
  eids: Uint32Array
  xs: Float32Array
  zs: Float32Array
}> = {
  create: () => ({
    cellHead: new Int32Array(GRID_COLUMNS * GRID_COLUMNS),
    nextInCell: new Int32Array(UNIT_COUNT),
    eids: new Uint32Array(UNIT_COUNT),
    xs: new Float32Array(UNIT_COUNT),
    zs: new Float32Array(UNIT_COUNT),
  }),
}

function setHeading(rotation: Vector4Field, eid: number, heading: number): void {
  rotation.set(eid, 0, Math.sin(heading / 2), 0, Math.cos(heading / 2))
}

function memberSlot(world: World, eid: number, formation: number): Point {
  const { center, offset, slot } = world.resource(FormationScratch)
  const formations = world.storage(Formation)
  const slots = world.storage(FormationSlot)
  center.x = formations.center.x.get(formation)
  center.z = formations.center.z.get(formation)
  offset.x = slots.x.get(eid)
  offset.z = slots.z.get(eid)
  return slotToWorld(center, formations.facing.get(formation), offset, slot)
}

function updateFormations(world: World): void {
  const { states } = world.resource(FormationScratch)
  const slots = world.storage(FormationSlot)
  const formations = world.storage(Formation)
  const targets = world.storage(MoveTarget)
  const { translation } = world.storage(Transform)
  states.clear()

  for (const eid of world.query(MEMBERS)) {
    const formation = slots.formation.get(eid)
    if (formation === 0) {
      world.remove(eid, FormationSlot)
      continue
    }
    let state = states.get(formation)
    if (!state) states.set(formation, (state = { lag: 0, heading: 0, active: false }))
    const slot = memberSlot(world, eid, formation)
    const lag = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (lag > state.lag) state.lag = lag
  }

  for (const eid of world.query(FORMATIONS)) {
    const state = states.get(eid)
    if (!state) {
      world.destroy(eid)
      continue
    }
    const { center, destination } = formations
    const dx = destination.x.get(eid) - center.x.get(eid)
    const dz = destination.z.get(eid) - center.z.get(eid)
    const remaining = Math.hypot(dx, dz)
    if (remaining === 0 && state.lag <= SETTLE_DISTANCE) {
      world.destroy(eid)
      continue
    }

    let arrived = remaining === 0
    if (state.lag <= FORMATION_REFORM_DISTANCE) {
      const step = FORMATION_SPEED * world.time.deltaTime
      if (remaining <= step) {
        center.x.set(eid, destination.x.get(eid))
        center.z.set(eid, destination.z.get(eid))
        arrived = true
      } else {
        center.x.set(eid, center.x.get(eid) + (dx / remaining) * step)
        center.z.set(eid, center.z.get(eid) + (dz / remaining) * step)
      }
    }
    state.heading = arrived ? formations.facing.get(eid) : Math.atan2(dx, dz)
    state.active = true
  }

  for (const eid of world.query(MEMBERS)) {
    const state = states.get(slots.formation.get(eid))
    if (!state?.active) continue
    const slot = memberSlot(world, eid, slots.formation.get(eid))
    if (world.has(eid, MoveTarget)) {
      targets.x.set(eid, slot.x)
      targets.z.set(eid, slot.z)
      targets.heading.set(eid, state.heading)
    } else {
      world.add(eid, MoveTarget, { x: slot.x, z: slot.z, heading: state.heading })
    }
  }
}

function moveUnits(world: World): void {
  const step = UNIT_SPEED * world.time.deltaTime
  const { translation, rotation } = world.storage(Transform)
  const targets = world.storage(MoveTarget)

  for (const eid of world.query(MOVERS)) {
    const dx = targets.x.get(eid) - translation.x.get(eid)
    const dz = targets.z.get(eid) - translation.z.get(eid)
    const distance = Math.hypot(dx, dz)
    if (distance <= ARRIVE_DISTANCE || distance <= step) {
      if (dx !== 0) translation.x.set(eid, targets.x.get(eid))
      if (dz !== 0) translation.z.set(eid, targets.z.get(eid))
      setHeading(rotation, eid, targets.heading.get(eid))
      if (!world.has(eid, FormationSlot)) world.remove(eid, MoveTarget)
      continue
    }
    setHeading(rotation, eid, Math.atan2(dx, dz))
    translation.x.set(eid, translation.x.get(eid) + (dx / distance) * step)
    translation.z.set(eid, translation.z.get(eid) + (dz / distance) * step)
  }
}

function cellIndex(coordinate: number): number {
  const cell = Math.floor((coordinate + GRID_HALF_SIZE) / MIN_SEPARATION)
  return Math.min(Math.max(cell, 0), GRID_COLUMNS - 1)
}

function separatePair(xs: Float32Array, zs: Float32Array, i: number, j: number): void {
  const dx = xs[j] - xs[i]
  const dz = zs[j] - zs[i]
  const distance = Math.hypot(dx, dz)
  if (distance >= MIN_SEPARATION) return
  const push = (MIN_SEPARATION - distance) / 2
  const nx = distance > 1e-6 ? dx / distance : 1
  const nz = distance > 1e-6 ? dz / distance : 0
  xs[i] -= nx * push
  zs[i] -= nz * push
  xs[j] += nx * push
  zs[j] += nz * push
}

function separateUnits(world: World): void {
  const { cellHead, nextInCell, eids, xs, zs } = world.resource(SeparationGrid)
  const { translation } = world.storage(Transform)

  let count = 0
  for (const eid of world.query(UNITS)) {
    eids[count] = eid
    xs[count] = translation.x.get(eid)
    zs[count] = translation.z.get(eid)
    count++
  }

  cellHead.fill(-1)
  for (let i = 0; i < count; i++) {
    const cell = cellIndex(zs[i]) * GRID_COLUMNS + cellIndex(xs[i])
    nextInCell[i] = cellHead[cell]
    cellHead[cell] = i
  }

  for (let i = 0; i < count; i++) {
    const column = cellIndex(xs[i])
    const row = cellIndex(zs[i])
    for (let r = Math.max(row - 1, 0); r <= Math.min(row + 1, GRID_COLUMNS - 1); r++) {
      for (let c = Math.max(column - 1, 0); c <= Math.min(column + 1, GRID_COLUMNS - 1); c++) {
        for (let j = cellHead[r * GRID_COLUMNS + c]; j !== -1; j = nextInCell[j]) {
          if (j > i) separatePair(xs, zs, i, j)
        }
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const eid = eids[i]
    if (xs[i] !== translation.x.get(eid)) translation.x.set(eid, xs[i])
    if (zs[i] !== translation.z.get(eid)) translation.z.set(eid, zs[i])
  }
}

function spawnUnits(world: World, mesh: MeshHandle): void {
  const { idle } = world.resource(UnitMaterials)
  const columns = Math.ceil(Math.sqrt(UNIT_COUNT))
  const rows = Math.ceil(UNIT_COUNT / columns)
  const offsetX = ((columns - 1) * FORMATION_SPACING) / 2
  const offsetZ = ((rows - 1) * FORMATION_SPACING) / 2
  for (let id = 0; id < UNIT_COUNT; id++) {
    const unit = world.create()
    world.add(unit, Unit)
    world.add(unit, Transform, {
      translation: [
        (id % columns) * FORMATION_SPACING - offsetX,
        UNIT_Y,
        Math.floor(id / columns) * FORMATION_SPACING - offsetZ,
      ],
    })
    world.add(unit, MeshInstance, { mesh })
    world.add(unit, MeshMaterial, idle)
  }
}

const FormationSystem: System = {
  name: 'formation',
  group: 'fixed',
  update: updateFormations,
}

const MoveSystem: System = {
  name: 'move',
  group: 'fixed',
  after: [FormationSystem],
  update: moveUnits,
}

const SeparationSystem: System = {
  name: 'separation',
  group: 'fixed',
  after: [MoveSystem],
  update: separateUnits,
}

export const UnitsPlugin: Plugin = {
  name: 'RtsUnits',
  recovery: 'stateless',
  components: [Unit, Selected, MoveTarget, Formation, FormationSlot],
  systems: [FormationSystem, MoveSystem, SeparationSystem],
  initialize(world) {
    const geometry = mergeMeshes([
      capsule(0.3, UNIT_HEIGHT - 0.6),
      { ...cube([0.2, 0.2, 0.3]), offset: [0, 0.5, 0.35] },
    ])
    spawnUnits(world, world.resource(Meshes).add({ name: 'unit', ...geometry }))
  },
}
