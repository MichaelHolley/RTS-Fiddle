import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core'
import type { LinesMesh, Scene } from '@babylonjs/core'
import type { Formation } from '../units/Formation'
import type { UnitManager } from '../units/UnitManager'

const LIFT = 0.05
const COLOR = new Color3(1, 0.9, 0.2)

export class FormationOutlines {
  private readonly scene: Scene
  private readonly unitManager: UnitManager
  private readonly outlines = new Map<Formation, LinesMesh>()

  constructor(scene: Scene, unitManager: UnitManager) {
    this.scene = scene
    this.unitManager = unitManager
    scene.onBeforeRenderObservable.add(this.sync)
  }

  private readonly sync = (): void => {
    const { formations } = this.unitManager
    for (const [formation, outline] of this.outlines) {
      if (formations.has(formation)) continue
      outline.dispose()
      this.outlines.delete(formation)
    }
    for (const formation of formations) {
      if (!this.outlines.has(formation)) this.outlines.set(formation, this.createOutline(formation))
    }
  }

  private createOutline({ destination, facing, width, depth }: Formation): LinesMesh {
    const x = width / 2
    const z = depth / 2
    const points = [
      new Vector3(-x, 0, -z),
      new Vector3(x, 0, -z),
      new Vector3(x, 0, z),
      new Vector3(-x, 0, z),
      new Vector3(-x, 0, -z),
    ]
    const outline = MeshBuilder.CreateLines('formationOutline', { points }, this.scene)
    outline.color = COLOR
    outline.isPickable = false
    outline.position.set(destination.x, destination.y + LIFT, destination.z)
    outline.rotation.y = facing
    return outline
  }
}
