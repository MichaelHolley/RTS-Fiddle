import { Devices, MeshMaterial, Transform } from '@dylanebert/shallot'
import type { Resource, System, World } from '@dylanebert/shallot'
import type { MaterialHandle } from '@dylanebert/shallot/standard/rendering'
import { KEYS } from '../config'
import { anyKey } from '../input/keys'
import { Soldier, Unit } from './components'
import { cameraPosition, soldierMaterial, SoldierModels, usesLod } from './model'

const LOD_DEBUG_TINT = [1, 0.1, 1, 1] as const

const SOLDIERS = [Soldier]

/** Indexed by `UnitTypeId`. */
const LodDebugMaterials: Resource<MaterialHandle[]> = {
  create: (world) => world.resource(SoldierModels).map((model) => soldierMaterial(world, model.palette, LOD_DEBUG_TINT)),
}

/** Debug view: L tints soldiers drawn with the LOD mesh. */
export const SoldierLod: Resource<{ highlight: boolean; count: number }> = {
  create: () => ({ highlight: false, count: 0 }),
}

function updateLodDebug(world: World): void {
  const state = world.resource(SoldierLod)
  if (anyKey(world.resource(Devices).keys.pressed, KEYS.lodDebug)) state.highlight = !state.highlight
  const models = world.resource(SoldierModels)
  const tints = world.resource(LodDebugMaterials)
  const unitType = world.storage(Unit).type
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  const { material } = world.storage(MeshMaterial)
  const camera = cameraPosition(world)
  state.count = 0
  for (const eid of world.query(SOLDIERS)) {
    const far = usesLod(camera, translation.x.get(eid), translation.z.get(eid))
    if (far) state.count++
    const type = unitType.get(soldiers.unit.get(eid))
    const wanted = (state.highlight && far ? tints[type] : models[type].material).material
    if (material.get(eid) !== wanted) material.set(eid, wanted)
  }
}

export const LodDebugSystem: System = {
  name: 'soldierLodDebug',
  group: 'simulation',
  update: updateLodDebug,
}
