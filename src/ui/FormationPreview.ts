import type { LinesMesh, Scene } from '@babylonjs/core'
import type { FormationPlan } from '../input/formation'
import { createOutline, placeOutline } from './outline'

export class FormationPreview {
  private readonly outline: LinesMesh

  constructor(scene: Scene) {
    this.outline = createOutline(scene)
    this.outline.setEnabled(false)
  }

  show({ center, facing, layout }: FormationPlan): void {
    placeOutline(this.outline, center, facing, layout.width, layout.depth)
    this.outline.setEnabled(true)
  }

  hide(): void {
    this.outline.setEnabled(false)
  }
}
