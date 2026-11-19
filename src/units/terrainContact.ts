import { Transform } from '@dylanebert/shallot'
import type { System, World } from '@dylanebert/shallot'
import { Terrain, terrainHeight } from '../terrain/heightmap'
import { Soldier } from './components'
import { SeparationSystem } from './separation'

const SOLDIERS = [Soldier]

// Runs after separation, which settles soldiers' ground positions, obstacles included.
function standOnGround(world: World): void {
  const map = world.resource(Terrain)
  const { translation } = world.storage(Transform)
  for (const eid of world.query(SOLDIERS)) {
    const y = terrainHeight(map, translation.x.get(eid), translation.z.get(eid))
    if (y !== translation.y.get(eid)) translation.y.set(eid, y)
  }
}

export const TerrainContactSystem: System = {
  name: 'terrainContact',
  group: 'fixed',
  after: [SeparationSystem],
  update: standOnGround,
}
