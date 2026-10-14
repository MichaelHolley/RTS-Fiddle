import type { LinesMesh, Scene } from '@babylonjs/core'
import type { FormationPlan, GridLayout } from '../input/formation'
import { createSlotMarkers, placeSlotMarkers } from './slotMarkers'

export class FormationPreview {
  private readonly scene: Scene
  private markers: LinesMesh | null = null
  private shape = ''

  constructor(scene: Scene) {
    this.scene = scene
  }

  show({ center, facing, layout }: FormationPlan): void {
    // Rebuilding the line mesh compiles a material, so only do it when the slot grid changes.
    const shape = shapeOf(layout)
    if (!this.markers || shape !== this.shape) {
      this.markers?.dispose()
      this.markers = createSlotMarkers(this.scene, layout.rows.flat())
      this.shape = shape
    }
    placeSlotMarkers(this.markers, center, facing)
    this.markers.setEnabled(true)
  }

  hide(): void {
    this.markers?.setEnabled(false)
  }
}

function shapeOf(layout: GridLayout): string {
  return layout.rows.map((row) => row.length).join(',')
}
