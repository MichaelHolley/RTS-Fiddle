import { MeshInstance, Transform } from '@dylanebert/shallot'
import type { System, World } from '@dylanebert/shallot'
import { RUN_MIN_SPEED } from '../config'
import { Soldier, SoldierAnimation } from './components'
import { cameraPosition, SoldierModel, usesLod } from './model'
import { SeparationSystem } from './separation'

const ANIMATED = [Soldier, SoldierAnimation]

// Steps are measured from actual displacement so separation pushes and formation catch-up animate too.
function animateSoldiers(world: World): void {
  const { detail, lod } = world.resource(SoldierModel)
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
    const { idle, run } = usesLod(camera, x, z) ? lod : detail
    let frame = idle
    if (step > minStep) {
      const phase = (animation.phase.get(eid) + step / animation.cycleLength.get(eid)) % 1
      animation.phase.set(eid, phase)
      frame = run[Math.floor(phase * run.length)]
    }
    if (mesh.get(eid) !== frame) mesh.set(eid, frame)
  }
}

export const AnimationSystem: System = {
  name: 'soldierAnimation',
  group: 'fixed',
  after: [SeparationSystem],
  update: animateSoldiers,
}
