import type { Engine } from '@babylonjs/core'
import type { UnitManager } from '../units/UnitManager'

const REFRESH_MS = 250

export class Hud {
  constructor(element: HTMLElement, groupsElement: HTMLElement, engine: Engine, unitManager: UnitManager) {
    const refresh = () => {
      element.textContent = `FPS: ${engine.getFps().toFixed(0)} | Units: ${unitManager.units.length} | Selected: ${unitManager.selectedCount}`
      const keys = [...unitManager.groups.keys()].sort()
      groupsElement.replaceChildren(...keys.map((key) => groupIcon(key, unitManager.groups.get(key)!.length)))
    }
    refresh()
    setInterval(refresh, REFRESH_MS)
  }
}

function groupIcon(key: string, count: number): HTMLElement {
  const icon = document.createElement('div')
  icon.className = 'group-icon'
  const keyLabel = document.createElement('span')
  keyLabel.className = 'group-key'
  keyLabel.textContent = key
  const countLabel = document.createElement('span')
  countLabel.textContent = String(count)
  icon.append(keyLabel, countLabel)
  return icon
}
