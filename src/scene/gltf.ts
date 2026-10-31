import type { Geometry } from './meshes'

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942
const FLOAT = 5126
const INDEX_ARRAYS = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array } as const
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3 } as const

interface Accessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: keyof typeof COMPONENTS
}

interface BufferView {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}

interface GltfJson {
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: Accessor[]
  bufferViews: BufferView[]
  images?: { bufferView?: number; mimeType?: string }[]
}

export interface GlbAsset {
  meshes: Map<string, Geometry>
  images: Blob[]
}

/** Loads the meshes and embedded images of a GLB. Supports one primitive per mesh with
 * unstrided float POSITION, NORMAL and TEXCOORD_0, which is what Blender's exporter writes. */
export async function loadGlb(url: string): Promise<GlbAsset> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return parseGlb(await response.arrayBuffer())
}

function parseGlb(buffer: ArrayBuffer): GlbAsset {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB file')
  let json: GltfJson | undefined
  let bin: Uint8Array<ArrayBuffer> | undefined
  for (let offset = 12; offset < buffer.byteLength; ) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const chunk = new Uint8Array(buffer, offset + 8, length)
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk)) as GltfJson
    else if (type === CHUNK_BIN) bin = chunk
    offset += 8 + length
  }
  if (!json || !bin) throw new Error('GLB is missing its JSON or BIN chunk')
  const gltf = json
  const data = bin

  const bytes = (accessor: Accessor, elementBytes: number): [number, number] => {
    const bufferView = gltf.bufferViews[accessor.bufferView]
    if (bufferView.byteStride && bufferView.byteStride !== elementBytes) {
      throw new Error('interleaved GLB buffers are not supported')
    }
    return [data.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count]
  }

  const floats = (index: number, components: number): Float32Array => {
    const accessor = gltf.accessors[index]
    if (accessor.componentType !== FLOAT || COMPONENTS[accessor.type] !== components) {
      throw new Error(`accessor ${index} is not a float ${components}-vector`)
    }
    const [offset, count] = bytes(accessor, components * 4)
    return new Float32Array(data.buffer, offset, count * components)
  }

  const indices = (index: number): Uint32Array => {
    const accessor = gltf.accessors[index]
    const IndexArray = INDEX_ARRAYS[accessor.componentType as keyof typeof INDEX_ARRAYS]
    if (!IndexArray) throw new Error(`accessor ${index} has unsupported index type`)
    const [offset, count] = bytes(accessor, IndexArray.BYTES_PER_ELEMENT)
    return Uint32Array.from(new IndexArray(data.buffer, offset, count))
  }

  const meshes = new Map<string, Geometry>()
  for (const mesh of gltf.meshes) {
    const [primitive] = mesh.primitives
    const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes
    if (POSITION === undefined || NORMAL === undefined || TEXCOORD_0 === undefined || primitive.indices === undefined) {
      throw new Error(`mesh ${mesh.name} needs POSITION, NORMAL, TEXCOORD_0 and indices`)
    }
    const position = floats(POSITION, 3)
    const normal = floats(NORMAL, 3)
    const uv = floats(TEXCOORD_0, 2)
    const count = position.length / 3
    const vertices = new Float32Array(count * 8)
    for (let i = 0; i < count; i++) {
      vertices.set([position[i * 3], position[i * 3 + 1], position[i * 3 + 2], uv[i * 2]], i * 8)
      vertices.set([normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2], uv[i * 2 + 1]], i * 8 + 4)
    }
    meshes.set(mesh.name, { vertices, indices: indices(primitive.indices) })
  }

  const images = (gltf.images ?? []).map(({ bufferView, mimeType }) => {
    if (bufferView === undefined) throw new Error('only embedded GLB images are supported')
    const { byteOffset = 0, byteLength } = gltf.bufferViews[bufferView]
    return new Blob([data.subarray(byteOffset, byteOffset + byteLength)], { type: mimeType })
  })

  return { meshes, images }
}
