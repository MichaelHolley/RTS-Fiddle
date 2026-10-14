import type { LinesMesh, Scene } from '@babylonjs/core'
import type { Formation } from '../units/Formation'
import type { UnitManager } from '../units/UnitManager'
import { createOutline, placeOutline } from './outline'

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
      if (this.outlines.has(formation)) continue
      const outline = createOutline(this.scene)
      placeOutline(outline, formation.destination, formation.facing, formation.width, formation.depth)
      this.outlines.set(formation, outline)
    }
  }
}
