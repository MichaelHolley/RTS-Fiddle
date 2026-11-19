import { PropShape } from '../config'
import type { Geometry } from '../scene/gltf'
import { random } from './noise'

type Vec3 = [number, number, number]
type Triangle = [Vec3, Vec3, Vec3]

/** sRGB colors of the prop palette texture, one texel each. */
export const PROP_PALETTE = ['#5b4030', '#2f5a2e', '#3d6b35', '#8a8780'] as const
const Texel = { Bark: 0, Needles: 1, NeedlesLight: 2, Rock: 3 } as const

const ROCK_VARIANTS = 3
const ROCK_SEGMENTS = 7
const ROCK_RINGS = 4
const ROCK_FLATTEN = 0.65
const ROCK_SINK = 0.25
const PINE_SEGMENTS = 7
const TRUNK = { bottom: -0.5, top: 8 }
/** Canopy cones as [base height, tip height, base radius], in units of the trunk radius. */
const PINE_CONES: readonly [number, number, number][] = [
  [5, 16, 6],
  [10, 21, 4.6],
  [15, 26, 3.2],
]

interface Part {
  triangles: Triangle[]
  /** A point inside the convex part, so every face can be wound to face away from it. */
  inside: Vec3
  texel: number
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Flat-shaded: every triangle gets its own vertices and face normal, for a low-poly look.
function flatMesh(parts: readonly Part[]): Geometry {
  const count = parts.reduce((sum, part) => sum + part.triangles.length, 0)
  const vertices = new Float32Array(count * 3 * 8)
  let v = 0
  for (const { triangles, inside, texel } of parts) {
    const u = (texel + 0.5) / PROP_PALETTE.length
    for (const triangle of triangles) {
      const [a, b, c] = triangle
      let normal = cross(sub(b, a), sub(c, a))
      const centroid: Vec3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
      const ordered = dot(normal, sub(centroid, inside)) >= 0 ? triangle : [a, c, b]
      if (ordered !== triangle) normal = [-normal[0], -normal[1], -normal[2]]
      const length = Math.hypot(...normal) || 1
      for (const p of ordered) {
        vertices.set([p[0], p[1], p[2], u, normal[0] / length, normal[1] / length, normal[2] / length, 0.5], v * 8)
        v++
      }
    }
  }
  return { vertices, indices: Uint32Array.from({ length: count * 3 }, (_, i) => i) }
}

function ring(segments: number, radius: number, y: number, jitter?: () => number): Vec3[] {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2
    const r = radius * (jitter?.() ?? 1)
    return [Math.cos(angle) * r, y, Math.sin(angle) * r]
  })
}

function band(lower: readonly Vec3[], upper: readonly Vec3[]): Triangle[] {
  return lower.flatMap((a, i): Triangle[] => {
    const b = lower[(i + 1) % lower.length]
    const c = upper[i]
    const d = upper[(i + 1) % upper.length]
    return [
      [a, b, c],
      [b, d, c],
    ]
  })
}

function fan(tip: Vec3, around: readonly Vec3[]): Triangle[] {
  return around.map((a, i): Triangle => [tip, a, around[(i + 1) % around.length]])
}

/** A lumpy, squashed ball about one unit across horizontally, sunk slightly into the ground. */
function rock(seed: number): Geometry {
  const rand = random(seed)
  const jitter = (): number => 0.8 + rand() * 0.25
  const rings = Array.from({ length: ROCK_RINGS - 1 }, (_, i) => {
    const theta = ((i + 1) / ROCK_RINGS) * Math.PI
    return ring(ROCK_SEGMENTS, Math.sin(theta), Math.cos(theta), jitter).map(
      ([x, y, z]): Vec3 => [x, (y * jitter() * ROCK_FLATTEN) - ROCK_SINK, z],
    )
  })
  const top: Vec3 = [0, ROCK_FLATTEN * jitter() - ROCK_SINK, 0]
  const bottom: Vec3 = [0, -ROCK_FLATTEN - ROCK_SINK, 0]
  const triangles = [
    ...fan(top, rings[0]),
    ...rings.slice(1).flatMap((lower, i) => band(lower, rings[i])),
    ...fan(bottom, rings[rings.length - 1]),
  ]
  return flatMesh([{ triangles, inside: [0, -ROCK_SINK, 0], texel: Texel.Rock }])
}

/** A pine with a trunk one unit in radius, the size of its collider. */
function pine(): Geometry {
  const lower = ring(PINE_SEGMENTS, 1, TRUNK.bottom)
  const upper = ring(PINE_SEGMENTS, 1, TRUNK.top)
  const parts: Part[] = [{ triangles: band(lower, upper), inside: [0, (TRUNK.bottom + TRUNK.top) / 2, 0], texel: Texel.Bark }]
  PINE_CONES.forEach(([base, tip, radius], i) => {
    const around = ring(PINE_SEGMENTS, radius, base)
    parts.push({
      triangles: [...fan([0, tip, 0], around), ...fan([0, base, 0], around)],
      inside: [0, base + (tip - base) / 4, 0],
      texel: i % 2 === 0 ? Texel.Needles : Texel.NeedlesLight,
    })
  })
  return flatMesh(parts)
}

/** Mesh variants of each prop shape, scaled so one unit is the collision radius. */
export function propMeshes(): Record<PropShape, Geometry[]> {
  return {
    [PropShape.Rock]: Array.from({ length: ROCK_VARIANTS }, (_, i) => rock(i + 1)),
    [PropShape.Pine]: [pine()],
  }
}
