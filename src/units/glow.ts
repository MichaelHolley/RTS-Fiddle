import { MeshInstance, MeshMaterial, NotShadowCaster, Transform } from '@dylanebert/shallot'
import type { System, Vector3Field, Vector4Field, World } from '@dylanebert/shallot'
import { AnimationSystem } from './animation'
import { Soldier, SoldierAnimation, SoldierGlow, Unit } from './components'
import type { GlowModel } from './model'
import { SoldierModels } from './model'

const GLOWING = [Soldier, SoldierAnimation, SoldierGlow]

interface Placement {
  translation: Vector3Field
  rotation: Vector4Field
}

function copyPlacement({ translation, rotation }: Placement, from: number, to: number): void {
  translation.set(to, translation.x.get(from), translation.y.get(from), translation.z.get(from))
  rotation.set(to, rotation.x.get(from), rotation.y.get(from), rotation.z.get(from), rotation.w.get(from))
}

/** Creates the entity drawing a soldier's glowing parts. Shallot has no transform hierarchy, so `GlowSystem` moves it. */
export function spawnGlow(world: World, soldier: number, glow: GlowModel): number {
  const eid = world.create()
  world.add(eid, Transform)
  copyPlacement(world.storage(Transform), soldier, eid)
  world.add(eid, MeshInstance, { mesh: glow.frames.idle })
  world.add(eid, MeshMaterial, glow.material)
  world.add(eid, NotShadowCaster)
  return eid
}

// The glow frames have no LOD set: they are a few hundred triangles and must stay visible from afar.
function syncGlow(world: World): void {
  const models = world.resource(SoldierModels)
  const unitType = world.storage(Unit).type
  const soldiers = world.storage(Soldier)
  const glows = world.storage(SoldierGlow)
  const { frame } = world.storage(SoldierAnimation)
  const transform = world.storage(Transform)
  const { mesh } = world.storage(MeshInstance)

  for (const eid of world.query(GLOWING)) {
    const glow = models[unitType.get(soldiers.unit.get(eid))].glow
    if (!glow) continue
    const target = glows.entity.get(eid)
    copyPlacement(transform, eid, target)
    const shown = frame.get(eid)
    const wanted = shown < 0 ? glow.frames.idle : glow.frames.run[shown]
    if (mesh.get(target) !== wanted) mesh.set(target, wanted)
  }
}

export const GlowSystem: System = {
  name: 'soldierGlow',
  group: 'fixed',
  after: [AnimationSystem],
  update: syncGlow,
}
