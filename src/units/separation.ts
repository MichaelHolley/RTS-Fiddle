import { Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import { FORMATION_SPACING, SOLDIER_COUNT, SOLDIER_RADIUS } from '../config'
import { Soldier } from './components'
import { MoveSystem, UnitScratch } from './movement'

const MIN_SEPARATION = SOLDIER_RADIUS * 2
// Half the formation spacing lets a soldier fit exactly between two neighbours of another unit.
const PASS_SEPARATION = FORMATION_SPACING / 2
// Cells must be at least as wide as the largest separation distance so the 3×3 neighbouring cells hold every overlap.
const CELL_SIZE = MIN_SEPARATION
// Cells hash into a table sized by soldier count rather than map area, so a bigger map costs nothing per tick.
const BUCKETS = 2 ** Math.ceil(Math.log2(SOLDIER_COUNT * 2))

const SOLDIERS = [Soldier]

interface Grid {
  bucketHead: Int32Array
  nextInBucket: Int32Array
  columns: Int32Array
  rows: Int32Array
  eids: Uint32Array
  units: Uint32Array
  /** March heading of the soldier's unit, NaN while the unit is idle. */
  headings: Float32Array
  xs: Float32Array
  zs: Float32Array
}

const SeparationGrid: Resource<Grid> = {
  create: () => ({
    bucketHead: new Int32Array(BUCKETS),
    nextInBucket: new Int32Array(SOLDIER_COUNT),
    columns: new Int32Array(SOLDIER_COUNT),
    rows: new Int32Array(SOLDIER_COUNT),
    eids: new Uint32Array(SOLDIER_COUNT),
    units: new Uint32Array(SOLDIER_COUNT),
    headings: new Float32Array(SOLDIER_COUNT),
    xs: new Float32Array(SOLDIER_COUNT),
    zs: new Float32Array(SOLDIER_COUNT),
  }),
}

function bucket(column: number, row: number): number {
  return (Math.imul(column, 73856093) ^ Math.imul(row, 19349663)) & (BUCKETS - 1)
}

/** Picks who keeps their path when soldiers of different units overlap, or -1 if neither unit is marching. */
function rightOfWay({ units, headings }: Grid, i: number, j: number): number {
  const iMarching = !Number.isNaN(headings[i])
  const jMarching = !Number.isNaN(headings[j])
  if (iMarching && jMarching) return units[i] < units[j] ? i : j
  if (iMarching) return i
  if (jMarching) return j
  return -1
}

// Sideways rather than along the contact normal, so head-on contacts part the formation instead of shoving it ahead.
function stepAside({ headings, xs, zs }: Grid, leader: number, yielder: number): void {
  const forwardX = Math.sin(headings[leader])
  const forwardZ = Math.cos(headings[leader])
  const dx = xs[yielder] - xs[leader]
  const dz = zs[yielder] - zs[leader]
  const along = dx * forwardX + dz * forwardZ
  const lateral = dz * forwardX - dx * forwardZ
  const clear = Math.sqrt(PASS_SEPARATION * PASS_SEPARATION - along * along)
  const push = (lateral < 0 ? -clear : clear) - lateral
  xs[yielder] -= forwardZ * push
  zs[yielder] += forwardX * push
}

function separatePair(grid: Grid, i: number, j: number): void {
  const { units, xs, zs } = grid
  const dx = xs[j] - xs[i]
  const dz = zs[j] - zs[i]
  const sameUnit = units[i] === units[j]
  const minDistance = sameUnit ? MIN_SEPARATION : PASS_SEPARATION
  const distance = Math.hypot(dx, dz)
  if (distance >= minDistance) return
  if (!sameUnit) {
    const leader = rightOfWay(grid, i, j)
    if (leader !== -1) return stepAside(grid, leader, leader === i ? j : i)
  }
  const push = (minDistance - distance) / 2
  const nx = distance > 1e-6 ? dx / distance : 1
  const nz = distance > 1e-6 ? dz / distance : 0
  xs[i] -= nx * push
  zs[i] -= nz * push
  xs[j] += nx * push
  zs[j] += nz * push
}

function separateSoldiers(world: World): void {
  const grid = world.resource(SeparationGrid)
  const { bucketHead, nextInBucket, columns, rows, eids, units, headings, xs, zs } = grid
  const { marching } = world.resource(UnitScratch)
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)

  let count = 0
  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    eids[count] = eid
    units[count] = unit
    headings[count] = marching.get(unit) ?? NaN
    xs[count] = translation.x.get(eid)
    zs[count] = translation.z.get(eid)
    count++
  }

  bucketHead.fill(-1)
  for (let i = 0; i < count; i++) {
    columns[i] = Math.floor(xs[i] / CELL_SIZE)
    rows[i] = Math.floor(zs[i] / CELL_SIZE)
    const b = bucket(columns[i], rows[i])
    nextInBucket[i] = bucketHead[b]
    bucketHead[b] = i
  }

  for (let i = 0; i < count; i++) {
    for (let r = rows[i] - 1; r <= rows[i] + 1; r++) {
      for (let c = columns[i] - 1; c <= columns[i] + 1; c++) {
        for (let j = bucketHead[bucket(c, r)]; j !== -1; j = nextInBucket[j]) {
          // Several cells can share a bucket; checking the cell visits each pair once.
          if (j > i && columns[j] === c && rows[j] === r) separatePair(grid, i, j)
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

export const SeparationSystem: System = {
  name: 'separation',
  group: 'fixed',
  after: [MoveSystem],
  update: separateSoldiers,
}
