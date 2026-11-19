import { MAP_SIZE, TERRAIN } from '../config'
import type { Geometry } from '../scene/gltf'
import { terrainHeight } from './heightmap'
import type { Heightmap } from './heightmap'
import { noise } from './noise'

const HALF_MAP = MAP_SIZE / 2
/** sRGB ground colors. */
const LOWLAND = [70, 104, 52]
const HIGHLAND = [128, 132, 78]
const DIRT = [116, 98, 72]
/** Slope (rise over run) where grass starts giving way to dirt, and where it is all dirt. */
const DIRT_SLOPE = [0.3, 0.65]
const PATCH_SIZE = 14
const PATCH_STRENGTH = 0.08

/** One vertex per heightmap sample, UVs spanning the whole map once. */
export function terrainGeometry(map: Heightmap): Geometry {
  const { columns, heights } = map
  const { cellSize } = TERRAIN
  const vertices = new Float32Array(columns * columns * 8)
  const at = (column: number, row: number): number =>
    heights[Math.min(Math.max(row, 0), columns - 1) * columns + Math.min(Math.max(column, 0), columns - 1)]
  for (let row = 0; row < columns; row++) {
    for (let column = 0; column < columns; column++) {
      const nx = (at(column - 1, row) - at(column + 1, row)) / (2 * cellSize)
      const nz = (at(column, row - 1) - at(column, row + 1)) / (2 * cellSize)
      const length = Math.hypot(nx, 1, nz)
      const u = column / (columns - 1)
      const v = row / (columns - 1)
      vertices.set(
        [u * MAP_SIZE - HALF_MAP, at(column, row), v * MAP_SIZE - HALF_MAP, u, nx / length, 1 / length, nz / length, v],
        (row * columns + column) * 8,
      )
    }
  }
  const cells = columns - 1
  const indices = new Uint32Array(cells * cells * 6)
  for (let row = 0; row < cells; row++) {
    for (let column = 0; column < cells; column++) {
      const a = row * columns + column
      indices.set([a, a + columns, a + 1, a + 1, a + columns, a + columns + 1], (row * cells + column) * 6)
    }
  }
  return { vertices, indices }
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Grass shading from lush lowland to dry highland, dirt on steep slopes, with noise patches. */
export function groundColors(map: Heightmap): ImageData {
  const size = TERRAIN.textureSize
  const texel = MAP_SIZE / size
  const image = new ImageData(size, size)
  const range = map.max - map.min || 1
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) * texel - HALF_MAP
      const z = (py + 0.5) * texel - HALF_MAP
      const height = terrainHeight(map, x, z)
      const slope = Math.hypot(
        terrainHeight(map, x + texel, z) - terrainHeight(map, x - texel, z),
        terrainHeight(map, x, z + texel) - terrainHeight(map, x, z - texel),
      ) / (2 * texel)
      const altitude = (height - map.min) / range
      const dirt = smoothstep(DIRT_SLOPE[0], DIRT_SLOPE[1], slope)
      const shade = 1 + noise(x / PATCH_SIZE, z / PATCH_SIZE, map.seed + 31) * PATCH_STRENGTH
      const i = (py * size + px) * 4
      for (let channel = 0; channel < 3; channel++) {
        const grass = LOWLAND[channel] + (HIGHLAND[channel] - LOWLAND[channel]) * altitude
        image.data[i + channel] = (grass + (DIRT[channel] - grass) * dirt) * shade
      }
      image.data[i + 3] = 255
    }
  }
  return image
}
