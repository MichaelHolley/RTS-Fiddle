import type { Resource } from '@dylanebert/shallot'
import { DEPLOY_CLEAR_RADIUS, FOREST, MAP_SIZE, OBSTACLE_GAP, PROP_TYPES } from '../config'
import type { Point } from '../units/formation'
import { Terrain } from './heightmap'
import { fbm, random } from './noise'

const HALF_MAP = MAP_SIZE / 2
const CELL_SIZE = 8
const COLUMNS = Math.ceil(MAP_SIZE / CELL_SIZE)
const MAX_RADIUS = Math.max(...PROP_TYPES.map((type) => type.radius[1]))
const FOREST_OCTAVES = 3

/** A circular obstacle soldiers cannot enter. `type` indexes `PROP_TYPES`. */
export interface Obstacle extends Point {
  type: number
  radius: number
  yaw: number
}

export interface ObstacleField {
  list: Obstacle[]
  /** Indices into `list`, bucketed by the grid cell holding each obstacle's center. */
  cells: number[][]
  /** Scratch filled by `findObstacles`. */
  found: Obstacle[]
}

const cellOf = (coordinate: number): number =>
  Math.min(Math.max(Math.floor((coordinate + HALF_MAP) / CELL_SIZE), 0), COLUMNS - 1)

/** Fills `field.found` with every obstacle whose edge is closer than `reach` to `(x, z)` and returns how many. */
export function findObstacles(field: ObstacleField, x: number, z: number, reach: number): number {
  const { list, cells, found } = field
  found.length = 0
  const span = Math.ceil((reach + MAX_RADIUS) / CELL_SIZE)
  const column = cellOf(x)
  const row = cellOf(z)
  for (let r = Math.max(row - span, 0); r <= Math.min(row + span, COLUMNS - 1); r++) {
    for (let c = Math.max(column - span, 0); c <= Math.min(column + span, COLUMNS - 1); c++) {
      for (const index of cells[r * COLUMNS + c]) {
        const obstacle = list[index]
        if (Math.hypot(obstacle.x - x, obstacle.z - z) - obstacle.radius < reach) found.push(obstacle)
      }
    }
  }
  return found.length
}

/** Moves `point` to the nearest spot where a circle of `radius` around it touches no obstacle. */
export function pushOutOfObstacles(field: ObstacleField, point: Point, radius: number): void {
  const count = findObstacles(field, point.x, point.z, radius)
  // OBSTACLE_GAP keeps obstacles a soldier apart, so leaving one never lands inside another.
  for (let i = 0; i < count; i++) {
    const { x, z, radius: obstacleRadius } = field.found[i]
    const dx = point.x - x
    const dz = point.z - z
    const distance = Math.hypot(dx, dz)
    const clearance = obstacleRadius + radius
    if (distance >= clearance) continue
    const scale = distance > 1e-6 ? clearance / distance : 0
    point.x = x + (scale === 0 ? clearance : dx * scale)
    point.z = z + dz * scale
  }
}

function place(field: ObstacleField, obstacle: Obstacle): void {
  field.cells[cellOf(obstacle.z) * COLUMNS + cellOf(obstacle.x)].push(field.list.length)
  field.list.push(obstacle)
}

// Jittered-grid scatter per prop type, with forests from a noise mask; candidates too close to placed obstacles are dropped.
function scatter(seed: number): ObstacleField {
  const field: ObstacleField = { list: [], cells: Array.from({ length: COLUMNS * COLUMNS }, () => []), found: [] }
  const rand = random(seed)
  const forestSeed = seed + 7919
  PROP_TYPES.forEach((type, index) => {
    const steps = Math.floor(MAP_SIZE / type.spacing)
    for (let row = 0; row < steps; row++) {
      for (let column = 0; column < steps; column++) {
        const x = (column + rand()) * type.spacing - HALF_MAP
        const z = (row + rand()) * type.spacing - HALF_MAP
        const radius = type.radius[0] + (type.radius[1] - type.radius[0]) * rand()
        const yaw = rand() * Math.PI * 2
        const forest = fbm(x / FOREST.wavelength, z / FOREST.wavelength, forestSeed, FOREST_OCTAVES) > FOREST.threshold
        if (rand() >= (forest ? type.forestDensity : type.density)) continue
        if (Math.hypot(x, z) < DEPLOY_CLEAR_RADIUS + radius) continue
        if (findObstacles(field, x, z, radius + OBSTACLE_GAP) > 0) continue
        place(field, { x, z, type: index, radius, yaw })
      }
    }
  })
  return field
}

export const Obstacles: Resource<ObstacleField> = {
  create: (world) => scatter(world.resource(Terrain).seed),
}
