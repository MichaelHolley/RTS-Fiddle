import { Transform } from '@dylanebert/shallot'
import type { System, World } from '@dylanebert/shallot'
import { SOLDIER_RADIUS } from '../config'
import { Terrain, terrainHeight } from '../terrain/heightmap'
import { Obstacles, pushOutOfObstacles } from '../terrain/obstacles'
import type { Point } from './formation'
import { Soldier } from './components'
import { SeparationSystem } from './separation'

const SOLDIERS = [Soldier]
const position: Point = { x: 0, z: 0 }

// Runs after separation so crowd pushes can never shove a soldier into an obstacle.
function keepOnTerrain(world: World): void {
  const map = world.resource(Terrain)
  const obstacles = world.resource(Obstacles)
  const { translation } = world.storage(Transform)
  for (const eid of world.query(SOLDIERS)) {
    position.x = translation.x.get(eid)
    position.z = translation.z.get(eid)
    pushOutOfObstacles(obstacles, position, SOLDIER_RADIUS)
    const y = terrainHeight(map, position.x, position.z)
    if (position.x !== translation.x.get(eid)) translation.x.set(eid, position.x)
    if (position.z !== translation.z.get(eid)) translation.z.set(eid, position.z)
    if (y !== translation.y.get(eid)) translation.y.set(eid, y)
  }
}

export const TerrainContactSystem: System = {
  name: 'terrainContact',
  group: 'fixed',
  after: [SeparationSystem],
  update: keepOnTerrain,
}
