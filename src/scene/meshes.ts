export function cylinder(
  radius = 0.5,
  height = 1,
  segments = 32,
): { vertices: Float32Array; indices: Uint32Array } {
  const half = height / 2
  const stride = segments + 1
  const vertices = new Float32Array((stride * 4 + 2) * 8)
  const indices: number[] = []
  let count = 0

  const push = (
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number => {
    vertices.set([px, py, pz, u, nx, ny, nz, v], count * 8)
    return count++
  }

  for (const y of [half, -half]) {
    for (let x = 0; x <= segments; x++) {
      const phi = (x / segments) * Math.PI * 2
      const nx = Math.cos(phi)
      const nz = Math.sin(phi)
      push(nx * radius, y, nz * radius, nx, 0, nz, x / segments, y > 0 ? 0 : 1)
    }
  }
  for (let x = 0; x < segments; x++) {
    indices.push(x, x + 1, x + stride, x + 1, x + 1 + stride, x + stride)
  }

  for (const sign of [1, -1]) {
    const center = push(0, sign * half, 0, 0, sign, 0, 0.5, 0.5)
    const ring = count
    for (let x = 0; x <= segments; x++) {
      const phi = (x / segments) * Math.PI * 2
      const nx = Math.cos(phi)
      const nz = Math.sin(phi)
      push(nx * radius, sign * half, nz * radius, 0, sign, 0, 0.5 + nx * 0.5, 0.5 + nz * 0.5)
    }
    for (let x = 0; x < segments; x++) {
      if (sign > 0) indices.push(center, ring + x + 1, ring + x)
      else indices.push(center, ring + x, ring + x + 1)
    }
  }

  return { vertices, indices: new Uint32Array(indices) }
}

export interface Geometry {
  vertices: Float32Array
  indices: Uint32Array
}

const VERTEX_FLOATS = 8

export function mergeMeshes(
  parts: readonly (Geometry & { offset?: readonly [number, number, number] })[],
): Geometry {
  const vertices = new Float32Array(parts.reduce((sum, part) => sum + part.vertices.length, 0))
  const indices = new Uint32Array(parts.reduce((sum, part) => sum + part.indices.length, 0))
  let vertexFloats = 0
  let indexCount = 0
  for (const { vertices: source, indices: sourceIndices, offset = [0, 0, 0] } of parts) {
    vertices.set(source, vertexFloats)
    for (let i = vertexFloats; i < vertexFloats + source.length; i += VERTEX_FLOATS) {
      vertices[i] += offset[0]
      vertices[i + 1] += offset[1]
      vertices[i + 2] += offset[2]
    }
    const base = vertexFloats / VERTEX_FLOATS
    for (let i = 0; i < sourceIndices.length; i++) indices[indexCount + i] = sourceIndices[i] + base
    vertexFloats += source.length
    indexCount += sourceIndices.length
  }
  return { vertices, indices }
}
