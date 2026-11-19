import { Camera, DirectionalLight, GlobalAmbientLight, lookAtRotation, StandardRenderer, Transform } from '@dylanebert/shallot'
import type { Plugin, Resource, World } from '@dylanebert/shallot'
import { Orbit, OrbitMode, OrbitPlugin } from '@dylanebert/shallot/extras'
import { CAMERA, FactionId } from '../config'
import { deployment } from '../units/deployment'

export const RtsView: Resource<{ camera: number }> = { create: () => ({ camera: 0 }) }

function createLights(world: World): void {
  Object.assign(world.resource(GlobalAmbientLight), { color: 0xd8e4ff, brightness: 380 })
  const sun = world.create()
  world.add(sun, Transform, { rotation: lookAtRotation(0, 0, 0, -1, -2, -1) })
  world.add(sun, DirectionalLight, { color: 0xffe8cc, illuminance: 6000 })
}

function createCamera(world: World): void {
  const camera = world.create()
  world.add(camera, Camera, { clearColor: 0x0f1217, fov: 45 })
  world.add(camera, StandardRenderer)
  world.add(camera, Transform)
  const { origin } = deployment(FactionId.Blue)
  world.add(camera, Orbit, {
    mode: OrbitMode.Manual,
    pan: [origin.x, 0, origin.z],
    yaw: CAMERA.yaw,
    pitch: CAMERA.pitch,
    distance: (CAMERA.minDistance + CAMERA.maxDistance) / 2,
    minDistance: CAMERA.minDistance,
    maxDistance: CAMERA.maxDistance,
  })
  world.resource(RtsView).camera = camera
}

export const WorldPlugin: Plugin = {
  name: 'RtsWorld',
  dependencies: [OrbitPlugin],
  initialize(world) {
    createLights(world)
    createCamera(world)
  },
}
