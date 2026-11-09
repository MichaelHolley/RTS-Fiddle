import { Devices, MeshMaterial, Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import { KEYS } from '../config'
import { anyKey } from '../input/keys'
import { Soldier } from './components'
import { cameraPosition, soldierMaterial, SoldierMaterial, usesLod } from './model'

const LOD_DEBUG_TINT = [1, 0.1, 1, 1] as const

const SOLDIERS = [Soldier]

const LodDebugMaterial: Resource<MaterialHandle> = { create: soldierMaterial(LOD_DEBUG_TINT) }

/** Debug view: L tints soldiers drawn with the LOD mesh. */
export const SoldierLod: Resource<{ highlight: boolean; count: number }> = {
  create: () => ({ highlight: false, count: 0 }),
}

function updateLodDebug(world: World): void {
  const state = world.resource(SoldierLod)
  if (anyKey(world.resource(Devices).keys.pressed, KEYS.lodDebug)) state.highlight = !state.highlight
  const normal = world.resource(SoldierMaterial).material
  const tinted = world.resource(LodDebugMaterial).material
  const { translation } = world.storage(Transform)
  const { material } = world.storage(MeshMaterial)
  const camera = cameraPosition(world)
  state.count = 0
  for (const eid of world.query(SOLDIERS)) {
    const far = usesLod(camera, translation.x.get(eid), translation.z.get(eid))
    if (far) state.count++
    const wanted = state.highlight && far ? tinted : normal
    if (material.get(eid) !== wanted) material.set(eid, wanted)
  }
}

export const LodDebugSystem: System = {
  name: 'soldierLodDebug',
  group: 'simulation',
  update: updateLodDebug,
}
