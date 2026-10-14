import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { Mesh, Scene } from '@babylonjs/core'
import { MAP_SIZE } from '../config'

const PROP_COUNT = 20
const PROP_AREA = MAP_SIZE * 0.9

export function createWorld(scene: Scene): Mesh {
  new HemisphericLight('ambient', new Vector3(0, 1, 0), scene).intensity = 0.7
  const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
  sun.intensity = 0.6

  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: MAP_SIZE, height: MAP_SIZE },
    scene,
  )
  const groundMaterial = new StandardMaterial('groundMaterial', scene)
  groundMaterial.diffuseColor = new Color3(0.28, 0.4, 0.26)
  groundMaterial.specularColor = Color3.Black()
  ground.material = groundMaterial

  for (let i = 0; i < PROP_COUNT; i++) {
    const width = 2 + Math.random() * 6
    const height = 2 + Math.random() * 8
    const prop =
      Math.random() < 0.5
        ? MeshBuilder.CreateBox(`prop${i}`, { width, height, depth: width }, scene)
        : MeshBuilder.CreateCylinder(
            `prop${i}`,
            { diameter: width, height },
            scene,
          )
    prop.position.set(
      (Math.random() - 0.5) * PROP_AREA,
      height / 2,
      (Math.random() - 0.5) * PROP_AREA,
    )
    prop.rotation.y = Math.random() * Math.PI
    prop.isPickable = false

    const material = new StandardMaterial(`propMaterial${i}`, scene)
    const shade = 0.35 + Math.random() * 0.35
    material.diffuseColor = new Color3(shade, shade, shade * 0.95)
    material.specularColor = Color3.Black()
    prop.material = material
  }

  return ground
}
