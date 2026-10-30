import {
  Camera,
  DirectionalLight,
  eulerToQuat,
  GlobalAmbientLight,
  lookAtRotation,
  Materials,
  Meshes,
  MeshInstance,
  MeshMaterial,
  StandardMaterial,
  StandardRenderer,
  Transform,
} from '@dylanebert/shallot'
import type { Plugin, Resource, World } from '@dylanebert/shallot'
import { Orbit, OrbitMode, OrbitPlugin } from '@dylanebert/shallot/extras'
import { CAMERA, MAP_SIZE } from '../config'
import { cylinder } from './meshes'

const PROP_COUNT = 20
const PROP_AREA = MAP_SIZE * 0.9

export const RtsView: Resource<{ camera: number }> = { create: () => ({ camera: 0 }) }

const linear = (channel: number): number => channel ** 2.2

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

function createProps(world: World): void {
  const materials = world.resource(Materials)
  const cylinderMesh = world.resource(Meshes).add({ name: 'cylinder', ...cylinder() })
  for (let i = 0; i < PROP_COUNT; i++) {
    const width = 2 + Math.random() * 6
    const height = 2 + Math.random() * 8
    const shade = 0.35 + Math.random() * 0.35

    const prop = world.create()
    world.add(prop, Transform, {
      translation: [
        (Math.random() - 0.5) * PROP_AREA,
        height / 2,
        (Math.random() - 0.5) * PROP_AREA,
      ],
      rotation: eulerToQuat(0, Math.random() * Math.PI, 0),
      scale: [width, height, width],
    })
    world.add(prop, MeshInstance, Math.random() < 0.5 ? {} : { mesh: cylinderMesh })
    world.add(
      prop,
      MeshMaterial,
      materials.add(
        StandardMaterial({
          baseColor: [linear(shade), linear(shade), linear(shade * 0.95), 1],
          perceptualRoughness: 0.9,
        }),
      ),
    )
  }
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
    createProps(world)
    createCamera(world)
  },
}
