import {
  ImageFilterMode,
  Materials,
  Meshes,
  MeshInstance,
  MeshMaterial,
  registerImage,
  StandardMaterial,
  Transform,
} from '@dylanebert/shallot'
import type { MeshHandle, Plugin, Resource, System, Vector4Field, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import {
  CAMERA,
  FORMATION_SPACING,
  MAP_SIZE,
  RUN_CYCLE_JITTER,
  RUN_CYCLE_LENGTH,
  RUN_MIN_SPEED,
  SOLDIER_COUNT,
  SOLDIER_MODEL_URL,
  SOLDIER_RADIUS,
  SOLDIER_SPEED,
  UNIT_COUNT,
  UNIT_DRIFT_DISTANCE,
  UNIT_GAP,
  UNIT_REFORM_DISTANCE,
  UNIT_SIZE,
  UNIT_SPEED,
  UNIT_START_FILES,
} from '../config'
import { loadGlb } from '../scene/gltf'
import { MoveTarget, Selected, Soldier, SoldierAnimation, Unit } from './components'
import { gridLayout, slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'

const ARRIVE_DISTANCE = 0.1
const DEPLOY_LINES = 2
const MIN_SEPARATION = SOLDIER_RADIUS * 2
const GRID_COLUMNS = Math.ceil(MAP_SIZE / MIN_SEPARATION)
const GRID_HALF_SIZE = MAP_SIZE / 2

const UNITS = [Unit]
const SOLDIERS = [Soldier]
const MOVERS = [Soldier, MoveTarget]
const ANIMATED = [Soldier, SoldierAnimation]

const SoldierModel: Resource<{ idle: MeshHandle; run: MeshHandle[]; palette: number }> = {
  create: () => ({ idle: 0 as MeshHandle, run: [], palette: -1 }),
}

const SoldierMaterial: Resource<MaterialHandle> = {
  create: (world) =>
    world
      .resource(Materials)
      .add(StandardMaterial({ baseColorTexture: world.resource(SoldierModel).palette, perceptualRoughness: 0.6 })),
}

async function loadSoldierModel(world: World): Promise<void> {
  const { meshes, images } = await loadGlb(SOLDIER_MODEL_URL)
  const registry = world.resource(Meshes)
  const add = (name: string): MeshHandle => {
    const geometry = meshes.get(name)
    if (!geometry) throw new Error(`${SOLDIER_MODEL_URL} has no mesh "${name}"`)
    return registry.add({ name: `trooper ${name}`, ...geometry })
  }
  const model = world.resource(SoldierModel)
  model.idle = add('idle')
  model.run = [...meshes.keys()].filter((name) => name.startsWith('run_')).sort().map(add)
  const nearest = ImageFilterMode.Nearest
  model.palette = registerImage(world, images[0], {
    sampler: { magFilter: nearest, minFilter: nearest, mipmapFilter: nearest },
  })
}

const UnitScratch: Resource<{
  lags: Map<number, number>
  marching: Map<number, number>
  center: Point
  offset: SlotOffset
  slot: Point
}> = {
  create: () => ({
    lags: new Map(),
    marching: new Map(),
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
    nextInCell: new Int32Array(SOLDIER_COUNT),
    eids: new Uint32Array(SOLDIER_COUNT),
    xs: new Float32Array(SOLDIER_COUNT),
    zs: new Float32Array(SOLDIER_COUNT),
  }),
}

function setHeading(rotation: Vector4Field, eid: number, heading: number): void {
  rotation.set(eid, 0, Math.sin(heading / 2), 0, Math.cos(heading / 2))
}

function isIdle(world: World, unit: number): boolean {
  const { center, destination } = world.storage(Unit)
  return center.x.get(unit) === destination.x.get(unit) && center.z.get(unit) === destination.z.get(unit)
}

function soldierSlot(world: World, soldier: number, unit: number): Point {
  const { center, offset, slot } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  center.x = units.center.x.get(unit)
  center.z = units.center.z.get(unit)
  offset.x = soldiers.slotX.get(soldier)
  offset.z = soldiers.slotZ.get(soldier)
  return slotToWorld(center, units.facing.get(unit), offset, slot)
}

function setMoveTarget(world: World, eid: number, slot: Point, heading: number): void {
  if (!world.has(eid, MoveTarget)) {
    world.add(eid, MoveTarget, { x: slot.x, z: slot.z, heading })
    return
  }
  const targets = world.storage(MoveTarget)
  targets.x.set(eid, slot.x)
  targets.z.set(eid, slot.z)
  targets.heading.set(eid, heading)
}

// A unit's center only advances while every soldier is within reform distance of its slot, so the block stays whole.
function updateUnits(world: World): void {
  const { lags, marching } = world.resource(UnitScratch)
  const units = world.storage(Unit)
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  lags.clear()
  marching.clear()

  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    const slot = soldierSlot(world, eid, unit)
    const lag = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (lag > (lags.get(unit) ?? 0)) lags.set(unit, lag)
  }

  const { center, destination } = units
  for (const unit of world.query(UNITS)) {
    const dx = destination.x.get(unit) - center.x.get(unit)
    const dz = destination.z.get(unit) - center.z.get(unit)
    const remaining = Math.hypot(dx, dz)
    if (remaining === 0) continue
    marching.set(unit, Math.atan2(dx, dz))
    if ((lags.get(unit) ?? 0) > UNIT_REFORM_DISTANCE) continue
    const step = UNIT_SPEED * world.time.deltaTime
    if (remaining <= step) {
      center.x.set(unit, destination.x.get(unit))
      center.z.set(unit, destination.z.get(unit))
    } else {
      center.x.set(unit, center.x.get(unit) + (dx / remaining) * step)
      center.z.set(unit, center.z.get(unit) + (dz / remaining) * step)
    }
  }

  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    const slot = soldierSlot(world, eid, unit)
    const heading = marching.get(unit)
    if (heading !== undefined) {
      setMoveTarget(world, eid, slot, heading)
      continue
    }
    const drift = Math.hypot(slot.x - translation.x.get(eid), slot.z - translation.z.get(eid))
    if (!world.has(eid, MoveTarget) && drift <= UNIT_DRIFT_DISTANCE) continue
    setMoveTarget(world, eid, slot, units.facing.get(unit))
  }
}

function moveSoldiers(world: World): void {
  const step = SOLDIER_SPEED * world.time.deltaTime
  const { translation, rotation } = world.storage(Transform)
  const targets = world.storage(MoveTarget)
  const soldiers = world.storage(Soldier)

  for (const eid of world.query(MOVERS)) {
    const dx = targets.x.get(eid) - translation.x.get(eid)
    const dz = targets.z.get(eid) - translation.z.get(eid)
    const distance = Math.hypot(dx, dz)
    if (distance <= ARRIVE_DISTANCE || distance <= step) {
      if (dx !== 0) translation.x.set(eid, targets.x.get(eid))
      if (dz !== 0) translation.z.set(eid, targets.z.get(eid))
      setHeading(rotation, eid, targets.heading.get(eid))
      if (isIdle(world, soldiers.unit.get(eid))) world.remove(eid, MoveTarget)
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

function separateSoldiers(world: World): void {
  const { cellHead, nextInCell, eids, xs, zs } = world.resource(SeparationGrid)
  const { translation } = world.storage(Transform)

  let count = 0
  for (const eid of world.query(SOLDIERS)) {
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

// Steps are measured from actual displacement so separation pushes and formation catch-up animate too.
function animateSoldiers(world: World): void {
  const { idle, run } = world.resource(SoldierModel)
  const { translation } = world.storage(Transform)
  const animation = world.storage(SoldierAnimation)
  const { mesh } = world.storage(MeshInstance)
  const minStep = RUN_MIN_SPEED * world.time.deltaTime

  for (const eid of world.query(ANIMATED)) {
    const x = translation.x.get(eid)
    const z = translation.z.get(eid)
    const step = Math.hypot(x - animation.lastX.get(eid), z - animation.lastZ.get(eid))
    animation.lastX.set(eid, x)
    animation.lastZ.set(eid, z)
    let frame = idle
    if (step > minStep) {
      const phase = (animation.phase.get(eid) + step / animation.cycleLength.get(eid)) % 1
      animation.phase.set(eid, phase)
      frame = run[Math.floor(phase * run.length)]
    }
    if (mesh.get(eid) !== frame) mesh.set(eid, frame)
  }
}

function spawnSoldier(world: World, unit: number, position: Point, facing: number, slot: SlotOffset): void {
  const { x, z } = position
  const soldier = world.create()
  world.add(soldier, Soldier, { unit, slotX: slot.x, slotZ: slot.z })
  world.add(soldier, Transform, { translation: [x, 0, z] })
  setHeading(world.storage(Transform).rotation, soldier, facing)
  const cycleLength = RUN_CYCLE_LENGTH * (1 + (Math.random() * 2 - 1) * RUN_CYCLE_JITTER)
  world.add(soldier, SoldierAnimation, { phase: Math.random(), cycleLength, lastX: x, lastZ: z })
  world.add(soldier, MeshInstance, { mesh: world.resource(SoldierModel).idle })
  world.add(soldier, MeshMaterial, world.resource(SoldierMaterial))
}

// The army deploys in lines of units at the map center, facing away from the starting camera.
function spawnArmy(world: World): void {
  const facing = CAMERA.yaw + Math.PI
  const layout = gridLayout(UNIT_SIZE, UNIT_START_FILES)
  const files = layout.rows[0].length
  const ranks = layout.rows.length
  const pitchX = (files - 1) * FORMATION_SPACING + UNIT_GAP
  const pitchZ = (ranks - 1) * FORMATION_SPACING + UNIT_GAP
  const perLine = Math.ceil(UNIT_COUNT / DEPLOY_LINES)
  const origin: Point = { x: 0, z: 0 }
  const position: Point = { x: 0, z: 0 }

  for (let i = 0; i < UNIT_COUNT; i++) {
    const line = Math.floor(i / perLine)
    const inLine = Math.min(perLine, UNIT_COUNT - line * perLine)
    const offset = { x: ((i % perLine) - (inLine - 1) / 2) * pitchX, z: ((DEPLOY_LINES - 1) / 2 - line) * pitchZ }
    const center = slotToWorld(origin, facing, offset, { x: 0, z: 0 })
    const unit = world.create()
    const at: [number, number, number] = [center.x, 0, center.z]
    world.add(unit, Unit, { center: at, destination: at, facing, files, ranks })
    for (const row of layout.rows) {
      for (const slot of row) spawnSoldier(world, unit, slotToWorld(center, facing, slot, position), facing, slot)
    }
  }
}

const UnitSystem: System = {
  name: 'units',
  group: 'fixed',
  update: updateUnits,
}

const MoveSystem: System = {
  name: 'move',
  group: 'fixed',
  after: [UnitSystem],
  update: moveSoldiers,
}

const SeparationSystem: System = {
  name: 'separation',
  group: 'fixed',
  after: [MoveSystem],
  update: separateSoldiers,
}

const AnimationSystem: System = {
  name: 'soldierAnimation',
  group: 'fixed',
  after: [SeparationSystem],
  update: animateSoldiers,
}

export const UnitsPlugin: Plugin = {
  name: 'RtsUnits',
  recovery: 'stateless',
  components: [Unit, Selected, Soldier, MoveTarget, SoldierAnimation],
  systems: [UnitSystem, MoveSystem, SeparationSystem, AnimationSystem],
  async initialize(world) {
    await loadSoldierModel(world)
    spawnArmy(world)
  },
}
