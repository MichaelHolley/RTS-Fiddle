import { MeshInstance, MeshMaterial, Transform } from '@dylanebert/shallot'
import type { Plugin, World } from '@dylanebert/shallot'
import { ARMY, CAMERA, FORMATION_SPACING, RUN_CYCLE_JITTER, RUN_CYCLE_LENGTH, UNIT_GAP, UNIT_TYPES } from '../config'
import { WorldPlugin } from '../scene/world'
import { AnimationSystem } from './animation'
import { MoveTarget, Selected, Soldier, SoldierAnimation, Unit } from './components'
import { gridLayout, slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'
import { LodDebugSystem } from './lodDebug'
import { loadSoldierModel, SoldierMaterial, SoldierModel } from './model'
import { MoveSystem, setHeading, UnitSystem } from './movement'
import { SeparationSystem } from './separation'

const DEPLOY_LINES = 2

function spawnSoldier(world: World, unit: number, position: Point, facing: number, slot: SlotOffset): void {
  const { x, z } = position
  const soldier = world.create()
  world.add(soldier, Soldier, { unit, slotX: slot.x, slotZ: slot.z })
  world.add(soldier, Transform, { translation: [x, 0, z] })
  setHeading(world.storage(Transform).rotation, soldier, facing)
  const cycleLength = RUN_CYCLE_LENGTH * (1 + (Math.random() * 2 - 1) * RUN_CYCLE_JITTER)
  world.add(soldier, SoldierAnimation, { phase: Math.random(), cycleLength, lastX: x, lastZ: z })
  world.add(soldier, MeshInstance, { mesh: world.resource(SoldierModel).detail.idle })
  world.add(soldier, MeshMaterial, world.resource(SoldierMaterial))
}

// The army deploys in lines of units at the map center, facing away from the starting camera, spaced for the largest unit.
function spawnArmy(world: World): void {
  const facing = CAMERA.yaw + Math.PI
  const layouts = ARMY.map((type) => gridLayout(UNIT_TYPES[type].size, UNIT_TYPES[type].startFiles))
  const maxFiles = Math.max(...layouts.map((layout) => layout.rows[0].length))
  const maxRanks = Math.max(...layouts.map((layout) => layout.rows.length))
  const pitchX = (maxFiles - 1) * FORMATION_SPACING + UNIT_GAP
  const pitchZ = (maxRanks - 1) * FORMATION_SPACING + UNIT_GAP
  const perLine = Math.ceil(ARMY.length / DEPLOY_LINES)
  const origin: Point = { x: 0, z: 0 }
  const position: Point = { x: 0, z: 0 }

  layouts.forEach((layout, i) => {
    const line = Math.floor(i / perLine)
    const inLine = Math.min(perLine, ARMY.length - line * perLine)
    const offset = { x: ((i % perLine) - (inLine - 1) / 2) * pitchX, z: ((DEPLOY_LINES - 1) / 2 - line) * pitchZ }
    const center = slotToWorld(origin, facing, offset, { x: 0, z: 0 })
    const unit = world.create()
    const at: [number, number, number] = [center.x, 0, center.z]
    const files = layout.rows[0].length
    const ranks = layout.rows.length
    world.add(unit, Unit, { type: ARMY[i], center: at, destination: at, facing, files, ranks })
    for (const row of layout.rows) {
      for (const slot of row) spawnSoldier(world, unit, slotToWorld(center, facing, slot, position), facing, slot)
    }
  })
}

export const UnitsPlugin: Plugin = {
  name: 'RtsUnits',
  dependencies: [WorldPlugin],
  recovery: 'stateless',
  components: [Unit, Selected, Soldier, MoveTarget, SoldierAnimation],
  systems: [UnitSystem, MoveSystem, SeparationSystem, AnimationSystem, LodDebugSystem],
  async initialize(world) {
    await loadSoldierModel(world)
    spawnArmy(world)
  },
}
