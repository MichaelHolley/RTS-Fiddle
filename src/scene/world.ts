import {
  Camera,
  DirectionalLight,
  GlobalAmbientLight,
  lookAtRotation,
  Materials,
  MeshInstance,
  MeshMaterial,
  StandardMaterial,
  StandardRenderer,
  Transform,
} from '@dylanebert/shallot'
import type { Plugin, Resource, World } from '@dylanebert/shallot'
import { Orbit, OrbitMode, OrbitPlugin } from '@dylanebert/shallot/extras'
import { CAMERA, MAP_SIZE } from '../config'
import { linear } from './color'

export const RtsView: Resource<{ camera: number }> = { create: () => ({ camera: 0 }) }

function createLights(world: World): void {
  Object.assign(world.resource(GlobalAmbientLight), { color: 0xd8e4ff, brightness: 380 })
  const sun = world.create()
  world.add(sun, Transform, { rotation: lookAtRotation(0, 0, 0, -1, -2, -1) })
  world.add(sun, DirectionalLight, { color: 0xffe8cc, illuminance: 6000 })
}

function createGround(world: World): void {
  const ground = world.create()
  world.add(ground, Transform, {
    translation: [0, -0.1, 0],
    scale: [MAP_SIZE, 0.2, MAP_SIZE],
  })
  world.add(ground, MeshInstance)
  world.add(
    ground,
    MeshMaterial,
    world.resource(Materials).add(
      StandardMaterial({
        baseColor: [linear(0.28), linear(0.4), linear(0.26), 1],
        perceptualRoughness: 0.9,
      }),
    ),
  )
}

function createCamera(world: World): void {
  const camera = world.create()
  world.add(camera, Camera, { clearColor: 0x0f1217, fov: 45 })
  world.add(camera, StandardRenderer)
  world.add(camera, Transform)
  world.add(camera, Orbit, {
    mode: OrbitMode.Manual,
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
    createGround(world)
    createCamera(world)
  },
}
