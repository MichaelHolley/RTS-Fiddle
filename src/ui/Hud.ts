import type { Engine } from '@babylonjs/core'
import type { UnitManager } from '../units/UnitManager'

const REFRESH_MS = 250

export class Hud {
  constructor(element: HTMLElement, engine: Engine, unitManager: UnitManager) {
    const refresh = () => {
      element.textContent = `FPS: ${engine.getFps().toFixed(0)} | Units: ${unitManager.units.length} | Selected: ${unitManager.selectedCount}`
    }
    refresh()
    setInterval(refresh, REFRESH_MS)
  }
}
