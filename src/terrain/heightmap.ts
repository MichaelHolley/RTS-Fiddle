import type { Resource } from '@dylanebert/shallot'
import { MAP_SIZE, TERRAIN } from '../config'
import { fbm } from './noise'

const HALF_MAP = MAP_SIZE / 2
const COLUMNS = Math.round(MAP_SIZE / TERRAIN.cellSize) + 1

export interface Heightmap {
  seed: number
  /** Samples per side; sample `(column, row)` sits at `(column, row) * cellSize - MAP_SIZE / 2`. */
  columns: number
  heights: Float32Array
  min: number
  max: number
}

function mapSeed(): number {
  const seed = Number.parseInt(new URLSearchParams(location.search).get('seed') ?? '', 10)
  return Number.isInteger(seed) ? seed : Math.floor(Math.random() * 1_000_000)
}

function generate(seed: number): Heightmap {
  const heights = new Float32Array(COLUMNS * COLUMNS)
  let min = Infinity
  let max = -Infinity
  for (let row = 0; row < COLUMNS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const x = column * TERRAIN.cellSize - HALF_MAP
      const z = row * TERRAIN.cellSize - HALF_MAP
      const height = fbm(x / TERRAIN.wavelength, z / TERRAIN.wavelength, seed, TERRAIN.octaves) * TERRAIN.relief
      heights[row * COLUMNS + column] = height
      min = Math.min(min, height)
      max = Math.max(max, height)
    }
  }
  return { seed, columns: COLUMNS, heights, min, max }
}

export const Terrain: Resource<Heightmap> = { create: () => generate(mapSeed()) }

const toGrid = (coordinate: number): number =>
  Math.min(Math.max((coordinate + HALF_MAP) / TERRAIN.cellSize, 0), COLUMNS - 1)

/** Ground height at a world position, bilinear between samples and clamped to the map edge. */
export function terrainHeight({ heights }: Heightmap, x: number, z: number): number {
  const gx = toGrid(x)
  const gz = toGrid(z)
  const column = Math.min(Math.floor(gx), COLUMNS - 2)
  const row = Math.min(Math.floor(gz), COLUMNS - 2)
  const fx = gx - column
  const fz = gz - row
  const i = row * COLUMNS + column
  const top = heights[i] + (heights[i + 1] - heights[i]) * fx
  const bottom = heights[i + COLUMNS] + (heights[i + COLUMNS + 1] - heights[i + COLUMNS]) * fx
  return top + (bottom - top) * fz
}
