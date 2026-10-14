import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core'
import type { Mesh, Scene, Vector3 } from '@babylonjs/core'

const DURATION_SECONDS = 0.5
const START_SCALE = 0.5
const END_SCALE = 1.5
const LIFT = 0.05

export class MoveMarker {
  private readonly mesh: Mesh
  private readonly material: StandardMaterial
  private elapsed = DURATION_SECONDS

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateTorus('moveMarker', { diameter: 2, thickness: 0.12, tessellation: 32 }, scene)
    this.mesh.isPickable = false
    this.mesh.setEnabled(false)

    this.material = new StandardMaterial('moveMarkerMaterial', scene)
    this.material.disableLighting = true
    this.material.emissiveColor = new Color3(1, 0.9, 0.2)
    this.mesh.material = this.material

    scene.onBeforeRenderObservable.add(() => this.update(scene.getEngine().getDeltaTime() / 1000))
  }

  play(point: Vector3): void {
    this.mesh.position.set(point.x, point.y + LIFT, point.z)
    this.elapsed = 0
    this.apply(0)
    this.mesh.setEnabled(true)
  }

  private update(dt: number): void {
    if (this.elapsed >= DURATION_SECONDS) return
    this.elapsed += dt
    if (this.elapsed >= DURATION_SECONDS) {
      this.mesh.setEnabled(false)
      return
    }
    this.apply(this.elapsed / DURATION_SECONDS)
  }

  private apply(t: number): void {
    this.mesh.scaling.setAll(START_SCALE + (END_SCALE - START_SCALE) * t)
    this.material.alpha = 1 - t
  }
}
