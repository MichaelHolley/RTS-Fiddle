import { MeshInstance, Transform } from '@dylanebert/shallot'
import type { System, World } from '@dylanebert/shallot'
import { RUN_MIN_SPEED } from '../config'
import { Soldier, SoldierAnimation, Unit } from './components'
import { cameraPosition, SoldierModels, usesLod } from './model'
import { SeparationSystem } from './separation'

const ANIMATED = [Soldier, SoldierAnimation]

// Steps are measured from actual displacement so separation pushes and formation catch-up animate too.
function animateSoldiers(world: World): void {
  const models = world.resource(SoldierModels)
  const unitType = world.storage(Unit).type
  const soldiers = world.storage(Soldier)
  const { translation } = world.storage(Transform)
  const camera = cameraPosition(world)
  const animation = world.storage(SoldierAnimation)
  const { mesh } = world.storage(MeshInstance)
  const minStep = RUN_MIN_SPEED * world.time.deltaTime

  for (const eid of world.query(ANIMATED)) {
    const x = translation.x.get(eid)
    const z = translation.z.get(eid)
    const step = Math.hypot(x - animation.lastX.get(eid), z - animation.lastZ.get(eid))
    animation.lastX.set(eid, x)
    animation.lastZ.set(eid, z)
    const model = models[unitType.get(soldiers.unit.get(eid))]
    const { idle, run } = usesLod(camera, x, z) ? model.lod : model.detail
    let frame = -1
    if (step > minStep) {
      const phase = (animation.phase.get(eid) + step / animation.cycleLength.get(eid)) % 1
      animation.phase.set(eid, phase)
      frame = Math.floor(phase * run.length)
    }
    animation.frame.set(eid, frame)
    const wanted = frame < 0 ? idle : run[frame]
    if (mesh.get(eid) !== wanted) mesh.set(eid, wanted)
  }
}

export const AnimationSystem: System = {
  name: 'soldierAnimation',
  group: 'fixed',
  after: [SeparationSystem],
  update: animateSoldiers,
}
