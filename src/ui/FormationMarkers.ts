import type { LinesMesh, Scene } from '@babylonjs/core'
import type { Formation } from '../units/Formation'
import type { UnitManager } from '../units/UnitManager'
import { createSlotMarkers, placeSlotMarkers } from './slotMarkers'

export class FormationMarkers {
  private readonly scene: Scene
  private readonly unitManager: UnitManager
  private readonly markers = new Map<Formation, LinesMesh>()

  constructor(scene: Scene, unitManager: UnitManager) {
    this.scene = scene
    this.unitManager = unitManager
    scene.onBeforeRenderObservable.add(this.sync)
  }

  private readonly sync = (): void => {
    const { formations } = this.unitManager
    for (const [formation, markers] of this.markers) {
      if (formations.has(formation)) continue
      markers.dispose()
      this.markers.delete(formation)
    }
    for (const formation of formations) {
      if (this.markers.has(formation)) continue
      const markers = createSlotMarkers(this.scene, formation.slots.values())
      placeSlotMarkers(markers, formation.destination, formation.facing)
      this.markers.set(formation, markers)
    }
  }
}
