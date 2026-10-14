import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { FORMATION_SPACING, MAP_SIZE, UNIT_COUNT, UNIT_RADIUS, UNIT_SPEED } from '../config'
import type { Formation } from './Formation'
import type { Unit } from './Unit'

const UNIT_HEIGHT = 1.8
const UNIT_Y = UNIT_HEIGHT / 2
const ARRIVE_DISTANCE = 0.1
const MIN_SEPARATION = UNIT_RADIUS * 2
const GRID_COLUMNS = Math.ceil(MAP_SIZE / MIN_SEPARATION)
const GRID_HALF_SIZE = MAP_SIZE / 2
const IDLE_COLOR = Color3.FromHexString('#dddddd')
const SELECTED_COLOR = Color3.FromHexString('#44ff66')

export class UnitManager {
  readonly units: readonly Unit[]
  readonly formations = new Set<Formation>()
  readonly groups = new Map<string, readonly number[]>()

  private readonly mesh: Mesh
  private selectionSize = 0
  private readonly matrices: Float32Array
  private readonly colors: Float32Array
  private readonly rotation = new Quaternion()
  private readonly tmpMatrix = new Matrix()
  private readonly cellHead = new Int32Array(GRID_COLUMNS * GRID_COLUMNS)
  private readonly nextInCell = new Int32Array(UNIT_COUNT)

  constructor(scene: Scene) {
    this.mesh = createUnitMesh(scene)
    this.units = spawnUnits(UNIT_COUNT)
    this.matrices = new Float32Array(UNIT_COUNT * 16)
    this.colors = new Float32Array(UNIT_COUNT * 4)

    for (const unit of this.units) {
      this.writeMatrix(unit)
      this.writeColor(unit)
    }

    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false)
    this.mesh.thinInstanceSetBuffer('color', this.colors, 4, false)
    this.mesh.alwaysSelectAsActiveMesh = true
  }

  get selectedCount(): number {
    return this.selectionSize
  }

  update(dt: number): void {
    const { units } = this
    const step = UNIT_SPEED * dt

    for (const formation of this.formations) {
      if (!formation.update(dt)) this.formations.delete(formation)
    }

    for (const unit of units) {
      const { position, target } = unit
      if (!target) continue
      const dx = target.x - position.x
      const dz = target.z - position.z
      const distance = Math.hypot(dx, dz)
      if (distance <= ARRIVE_DISTANCE || distance <= step) {
        position.x = target.x
        position.z = target.z
        unit.target = null
        continue
      }
      unit.heading = Math.atan2(dx, dz)
      position.x += (dx / distance) * step
      position.z += (dz / distance) * step
    }

    this.separate()

    for (const unit of units) this.writeMatrix(unit)
    this.mesh.thinInstanceBufferUpdated('matrix')
  }

  setSelection(ids: Iterable<number>, additive: boolean): void {
    const next = new Set(ids)
    let changed = false
    let count = 0
    for (const unit of this.units) {
      const selected = next.has(unit.id) || (additive && unit.selected)
      if (selected) count++
      if (selected === unit.selected) continue
      unit.selected = selected
      this.writeColor(unit)
      changed = true
    }
    this.selectionSize = count
    if (changed) this.mesh.thinInstanceBufferUpdated('color')
  }

  clearSelection(): void {
    this.setSelection([], false)
  }

  selected(): Unit[] {
    return this.units.filter((unit) => unit.selected)
  }

  assignGroup(key: string): void {
    const ids = this.selected().map((unit) => unit.id)
    if (ids.length > 0) this.groups.set(key, ids)
    else this.groups.delete(key)
  }

  recallGroup(key: string, additive: boolean): void {
    const ids = this.groups.get(key)
    if (ids) this.setSelection(ids, additive)
  }

  issueMove(formation: Formation): void {
    for (const existing of this.formations) {
      existing.release(formation.slots.keys())
      if (existing.slots.size === 0) this.formations.delete(existing)
    }
    this.formations.add(formation)
  }

  private separate(): void {
    const { units, cellHead, nextInCell } = this
    cellHead.fill(-1)
    for (let i = 0; i < units.length; i++) {
      const { position } = units[i]
      const cell = cellIndex(position.z) * GRID_COLUMNS + cellIndex(position.x)
      nextInCell[i] = cellHead[cell]
      cellHead[cell] = i
    }

    for (let i = 0; i < units.length; i++) {
      const a = units[i].position
      const column = cellIndex(a.x)
      const row = cellIndex(a.z)
      for (let r = Math.max(row - 1, 0); r <= Math.min(row + 1, GRID_COLUMNS - 1); r++) {
        for (let c = Math.max(column - 1, 0); c <= Math.min(column + 1, GRID_COLUMNS - 1); c++) {
          for (let j = cellHead[r * GRID_COLUMNS + c]; j !== -1; j = nextInCell[j]) {
            if (j > i) separatePair(a, units[j].position)
          }
        }
      }
    }
  }

  private writeMatrix(unit: Unit): void {
    Quaternion.RotationYawPitchRollToRef(unit.heading, 0, 0, this.rotation)
    Matrix.ComposeToRef(Vector3.OneReadOnly, this.rotation, unit.position, this.tmpMatrix)
    this.tmpMatrix.copyToArray(this.matrices, unit.id * 16)
  }

  private writeColor(unit: Unit): void {
    const color = unit.selected ? SELECTED_COLOR : IDLE_COLOR
    const offset = unit.id * 4
    this.colors[offset] = color.r
    this.colors[offset + 1] = color.g
    this.colors[offset + 2] = color.b
    this.colors[offset + 3] = 1
  }
}

function cellIndex(coordinate: number): number {
  const cell = Math.floor((coordinate + GRID_HALF_SIZE) / MIN_SEPARATION)
  return Math.min(Math.max(cell, 0), GRID_COLUMNS - 1)
}

function separatePair(a: Vector3, b: Vector3): void {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const distance = Math.hypot(dx, dz)
  if (distance >= MIN_SEPARATION) return
  const push = (MIN_SEPARATION - distance) / 2
  const nx = distance > 1e-6 ? dx / distance : 1
  const nz = distance > 1e-6 ? dz / distance : 0
  a.x -= nx * push
  a.z -= nz * push
  b.x += nx * push
  b.z += nz * push
}

function createUnitMesh(scene: Scene): Mesh {
  const body = MeshBuilder.CreateCapsule('unitBody', { radius: 0.3, height: UNIT_HEIGHT }, scene)
  const nose = MeshBuilder.CreateBox('unitNose', { width: 0.2, height: 0.2, depth: 0.3 }, scene)
  nose.position.set(0, 0.5, 0.35)

  const mesh = Mesh.MergeMeshes([body, nose], true)
  if (!mesh) throw new Error('Failed to merge unit meshes')
  mesh.name = 'unit'
  mesh.isPickable = false

  const material = new StandardMaterial('unitMaterial', scene)
  material.diffuseColor = Color3.White()
  material.specularColor = Color3.Black()
  mesh.material = material
  return mesh
}

function spawnUnits(count: number): Unit[] {
  const columns = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const offsetX = ((columns - 1) * FORMATION_SPACING) / 2
  const offsetZ = ((rows - 1) * FORMATION_SPACING) / 2
  return Array.from({ length: count }, (_, id) => ({
    id,
    position: new Vector3(
      (id % columns) * FORMATION_SPACING - offsetX,
      UNIT_Y,
      Math.floor(id / columns) * FORMATION_SPACING - offsetZ,
    ),
    target: null,
    heading: 0,
    selected: false,
  }))
}
