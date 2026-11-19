const GRADIENTS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)])

/** Seeded uniform random numbers in [0, 1) (mulberry32). */
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function corner(ix: number, iz: number, seed: number, fx: number, fz: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  const [gx, gz] = GRADIENTS[(h ^ (h >>> 16)) & 7]
  return gx * fx + gz * fz
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
const mix = (a: number, b: number, t: number): number => a + (b - a) * t

/** Gradient noise with features one unit apart, roughly in [-1, 1]. */
export function noise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fade(fx)
  const top = mix(corner(ix, iz, seed, fx, fz), corner(ix + 1, iz, seed, fx - 1, fz), u)
  const bottom = mix(corner(ix, iz + 1, seed, fx, fz - 1), corner(ix + 1, iz + 1, seed, fx - 1, fz - 1), u)
  return mix(top, bottom, fade(fz)) * Math.SQRT2
}

/** Octaves of `noise`, each half the size and strength of the last, roughly in [-1, 1]. */
export function fbm(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, z, seed + i * 1013) * amplitude
    total += amplitude
    amplitude /= 2
    x *= 2
    z *= 2
  }
  return sum / total
}
