import type { World } from '@dylanebert/shallot'
import { ControlGroups, selectedCount, SelectionDrag } from '../input/selection'
import { Unit } from '../units/components'

const REFRESH_MS = 250
const UNITS = [Unit]

function element(parent: HTMLElement, id: string): HTMLElement {
  const created = document.createElement('div')
  created.id = id
  parent.append(created)
  return created
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

function unitCount(world: World): number {
  let count = 0
  for (const _ of world.query(UNITS)) count++
  return count
}

export function mountUi(container: HTMLElement, world: World): () => void {
  const hud = element(container, 'hud')
  const groupsElement = element(container, 'groups')
  const box = element(container, 'selection-box')
  const drag = world.resource(SelectionDrag)
  const groups = world.resource(ControlGroups)

  let frames = 0
  let lastRefresh = performance.now()

  const refresh = (now: number): void => {
    const fps = (frames * 1000) / (now - lastRefresh)
    frames = 0
    lastRefresh = now
    hud.textContent = `FPS: ${fps.toFixed(0)} | Units: ${unitCount(world)} | Selected: ${selectedCount(world)}`
    const keys = [...groups.keys()].sort()
    groupsElement.replaceChildren(...keys.map((key) => groupIcon(key, groups.get(key)!.length)))
  }

  const positionBox = (): void => {
    if (!drag.active || !drag.dragging) {
      box.style.display = 'none'
      return
    }
    const { style } = box
    style.left = `${Math.min(drag.startX, drag.currentX)}px`
    style.top = `${Math.min(drag.startY, drag.currentY)}px`
    style.width = `${Math.abs(drag.currentX - drag.startX)}px`
    style.height = `${Math.abs(drag.currentY - drag.startY)}px`
    style.display = 'block'
  }

  let raf = 0
  const loop = (): void => {
    frames++
    positionBox()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  refresh(performance.now())
  const interval = setInterval(() => refresh(performance.now()), REFRESH_MS)

  return () => {
    clearInterval(interval)
    cancelAnimationFrame(raf)
    hud.remove()
    groupsElement.remove()
    box.remove()
  }
}
