import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core'
import type { LinesMesh, Scene } from '@babylonjs/core'

const LIFT = 0.05
const COLOR = new Color3(1, 0.9, 0.2)
const UNIT_SQUARE = [
  new Vector3(-0.5, 0, -0.5),
  new Vector3(0.5, 0, -0.5),
  new Vector3(0.5, 0, 0.5),
  new Vector3(-0.5, 0, 0.5),
  new Vector3(-0.5, 0, -0.5),
]

export function createOutline(scene: Scene): LinesMesh {
  const outline = MeshBuilder.CreateLines('formationOutline', { points: UNIT_SQUARE }, scene)
  outline.color = COLOR
  outline.isPickable = false
  return outline
}

export function placeOutline(outline: LinesMesh, center: Vector3, facing: number, width: number, depth: number): void {
  outline.position.set(center.x, center.y + LIFT, center.z)
  outline.rotation.y = facing
  outline.scaling.set(width, 1, depth)
}
