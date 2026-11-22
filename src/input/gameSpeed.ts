import { Devices, InputPlugin } from '@dylanebert/shallot'
import type { Plugin, System, World } from '@dylanebert/shallot'
import { GAME_SPEEDS, KEYS } from '../config'
import { anyKey } from './keys'

const NORMAL_SPEED = GAME_SPEEDS.indexOf(1)

function speedIndex(world: World): number {
  const index = GAME_SPEEDS.indexOf(world.time.scale)
  return index === -1 ? NORMAL_SPEED : index
}

export function gameSpeedLabel(world: World): string {
  const { paused, scale } = world.time
  return paused ? `PAUSED | Speed: ${scale}×` : `Speed: ${scale}×`
}

function updateGameSpeed(world: World): void {
  const { keys } = world.resource(Devices)
  if (anyKey(keys.held, KEYS.ctrl)) return
  if (anyKey(keys.pressed, KEYS.pause)) {
    if (world.time.paused) world.resume()
    else world.pause()
  }
  const step = Number(anyKey(keys.pressed, KEYS.speedUp)) - Number(anyKey(keys.pressed, KEYS.speedDown))
  if (step === 0) return
  const index = Math.min(GAME_SPEEDS.length - 1, Math.max(0, speedIndex(world) + step))
  world.setTimeScale(GAME_SPEEDS[index])
}

const GameSpeedSystem: System = {
  name: 'gameSpeed',
  group: 'simulation',
  update: updateGameSpeed,
}

export const GameSpeedPlugin: Plugin = {
  name: 'GameSpeed',
  dependencies: [InputPlugin],
  systems: [GameSpeedSystem],
}
