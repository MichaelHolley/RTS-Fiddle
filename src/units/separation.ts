import { Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import { FORMATION_SPACING, SOLDIER_COUNT, SOLDIER_RADIUS } from '../config'
import { isBlocked, Obstacles, pushOutOfObstacles } from '../terrain/obstacles'
import type { ObstacleField } from '../terrain/obstacles'
import type { Point } from './formation'
import { cellBucket, createCellGrid, fillCellGrid } from './cellGrid'
import type { CellGrid } from './cellGrid'
import { Soldier, Unit } from './components'
import { MoveSystem, UnitScratch } from './movement'

const MIN_SEPARATION = SOLDIER_RADIUS * 2
// Half the formation spacing lets a soldier fit exactly between two neighbours of another unit.
const PASS_SEPARATION = FORMATION_SPACING / 2
// Cells must be at least as wide as the largest separation distance so the 3×3 neighbouring cells hold every overlap.
const CELL_SIZE = MIN_SEPARATION
// Each pass undoes a little of the last one's work; repeating settles crowds pressed against obstacles instead of jittering.
const SOLVER_PASSES = 3
const position: Point = { x: 0, z: 0 }

const SOLDIERS = [Soldier]

interface Grid {
  cells: CellGrid
  eids: Uint32Array
  units: Uint32Array
  factions: Uint32Array
  /** March heading of the soldier's unit, NaN while the unit is idle. */
  headings: Float32Array
  xs: Float32Array
  zs: Float32Array
}

const SeparationGrid: Resource<Grid> = {
  create: () => ({
    cells: createCellGrid(CELL_SIZE, SOLDIER_COUNT),
    eids: new Uint32Array(SOLDIER_COUNT),
    units: new Uint32Array(SOLDIER_COUNT),
    factions: new Uint32Array(SOLDIER_COUNT),
    headings: new Float32Array(SOLDIER_COUNT),
    xs: new Float32Array(SOLDIER_COUNT),
    zs: new Float32Array(SOLDIER_COUNT),
  }),
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

/**
 * Sideways rather than along the contact normal, so head-on contacts part the formation instead of shoving it ahead.
 * Returns false, moving nobody, when the step would land in an obstacle.
 */
function stepAside({ headings, xs, zs }: Grid, obstacles: ObstacleField, leader: number, yielder: number): boolean {
  const forwardX = Math.sin(headings[leader])
  const forwardZ = Math.cos(headings[leader])
  const dx = xs[yielder] - xs[leader]
  const dz = zs[yielder] - zs[leader]
  const along = dx * forwardX + dz * forwardZ
  const lateral = dz * forwardX - dx * forwardZ
  const clear = Math.sqrt(PASS_SEPARATION * PASS_SEPARATION - along * along)
  const push = (lateral < 0 ? -clear : clear) - lateral
  const x = xs[yielder] - forwardZ * push
  const z = zs[yielder] + forwardX * push
  if (isBlocked(obstacles, x, z, SOLDIER_RADIUS)) return false
  xs[yielder] = x
  zs[yielder] = z
  return true
}

// Friendly units pass through each other; soldiers of the same unit and enemies keep full body distance.
function separatePair(grid: Grid, obstacles: ObstacleField, i: number, j: number): void {
  const { units, factions, xs, zs } = grid
  const dx = xs[j] - xs[i]
  const dz = zs[j] - zs[i]
  const passing = units[i] !== units[j] && factions[i] === factions[j]
  const minDistance = passing ? PASS_SEPARATION : MIN_SEPARATION
  const distance = Math.hypot(dx, dz)
  if (distance >= minDistance) return
  if (passing) {
    const leader = rightOfWay(grid, i, j)
    if (leader !== -1 && stepAside(grid, obstacles, leader, leader === i ? j : i)) return
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
  const obstacles = world.resource(Obstacles)
  const { cells, eids, units, factions, headings, xs, zs } = grid
  const { bucketHead, nextInBucket, columns, rows } = cells
  const { marching } = world.resource(UnitScratch)
  const soldiers = world.storage(Soldier)
  const { faction } = world.storage(Unit)
  const { translation } = world.storage(Transform)

  let count = 0
  for (const eid of world.query(SOLDIERS)) {
    const unit = soldiers.unit.get(eid)
    eids[count] = eid
    units[count] = unit
    factions[count] = faction.get(unit)
    headings[count] = marching.get(unit) ?? NaN
    xs[count] = translation.x.get(eid)
    zs[count] = translation.z.get(eid)
    count++
  }

  for (let pass = 0; pass < SOLVER_PASSES; pass++) {
    fillCellGrid(cells, xs, zs, count)

    for (let i = 0; i < count; i++) {
      for (let r = rows[i] - 1; r <= rows[i] + 1; r++) {
        for (let c = columns[i] - 1; c <= columns[i] + 1; c++) {
          for (let j = bucketHead[cellBucket(cells, c, r)]; j !== -1; j = nextInBucket[j]) {
            // Several cells can share a bucket; checking the cell visits each pair once.
            if (j > i && columns[j] === c && rows[j] === r) separatePair(grid, obstacles, i, j)
          }
        }
      }
    }

    // Obstacles come last in every pass, so no soldier ends the tick inside one.
    for (let i = 0; i < count; i++) {
      position.x = xs[i]
      position.z = zs[i]
      pushOutOfObstacles(obstacles, position, SOLDIER_RADIUS)
      xs[i] = position.x
      zs[i] = position.z
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
