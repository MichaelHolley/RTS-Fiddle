import { MeshInstance, MeshMaterial, Transform } from '@dylanebert/shallot'
import type { Plugin, World } from '@dylanebert/shallot'
import { ATTACK_JITTER, FACTIONS, FactionId, FORMATION_SPACING, RUN_CYCLE_JITTER, RUN_CYCLE_LENGTH, UNIT_GAP, UNIT_TYPES } from '../config'
import type { UnitTypeId } from '../config'
import { WorldPlugin } from '../scene/world'
import { Terrain, terrainHeight } from '../terrain/heightmap'
import { AnimationSystem } from './animation'
import { AttackOrder, Combatant, MoveTarget, Selected, Soldier, SoldierAnimation, SoldierGlow, Unit } from './components'
import { deployment } from './deployment'
import { gridLayout, slotToWorld } from './formation'
import type { Point, SlotOffset } from './formation'
import { GlowSystem, spawnGlow } from './glow'
import { LodDebugSystem } from './lodDebug'
import { loadSoldierModels, SoldierModels } from './model'
import { MoveSystem, setHeading, UnitSystem } from './movement'
import { SeparationSystem } from './separation'
import { TerrainContactSystem } from './terrainContact'

const DEPLOY_LINES = 2

function spawnSoldier(
  world: World,
  unit: number,
  type: UnitTypeId,
  faction: FactionId,
  position: Point,
  facing: number,
  slot: SlotOffset,
): void {
  const { x, z } = position
  const model = world.resource(SoldierModels)[type]
  const stats = UNIT_TYPES[type]
  const soldier = world.create()
  world.add(soldier, Soldier, { unit, slotX: slot.x, slotZ: slot.z })
  world.add(soldier, Transform, { translation: [x, terrainHeight(world.resource(Terrain), x, z), z] })
  setHeading(world.storage(Transform).rotation, soldier, facing)
  const cycleLength = RUN_CYCLE_LENGTH * (1 + (Math.random() * 2 - 1) * RUN_CYCLE_JITTER)
  world.add(soldier, SoldierAnimation, { phase: Math.random(), cycleLength, lastX: x, lastZ: z, frame: -1 })
  world.add(soldier, MeshInstance, { mesh: model.detail.idle })
  world.add(soldier, MeshMaterial, model.materials[faction])
  const interval = (stats.ranged ?? stats.melee).interval
  world.add(soldier, Combatant, { health: stats.health, cooldown: Math.random() * interval * (1 + ATTACK_JITTER) })
  if (model.glow) world.add(soldier, SoldierGlow, { entity: spawnGlow(world, soldier, model.glow) })
}

// An army deploys in lines of units around its deployment origin, spaced for the largest unit.
function spawnArmy(world: World, faction: FactionId): void {
  const army = FACTIONS[faction].army
  const { origin, facing } = deployment(faction)
  const layouts = army.map((type) => gridLayout(UNIT_TYPES[type].size, UNIT_TYPES[type].startFiles))
  const maxFiles = Math.max(...layouts.map((layout) => layout.rows[0].length))
  const maxRanks = Math.max(...layouts.map((layout) => layout.rows.length))
  const pitchX = (maxFiles - 1) * FORMATION_SPACING + UNIT_GAP
  const pitchZ = (maxRanks - 1) * FORMATION_SPACING + UNIT_GAP
  const perLine = Math.ceil(army.length / DEPLOY_LINES)
  const position: Point = { x: 0, z: 0 }

  layouts.forEach((layout, i) => {
    const line = Math.floor(i / perLine)
    const inLine = Math.min(perLine, army.length - line * perLine)
    const offset = { x: ((i % perLine) - (inLine - 1) / 2) * pitchX, z: ((DEPLOY_LINES - 1) / 2 - line) * pitchZ }
    const center = slotToWorld(origin, facing, offset, { x: 0, z: 0 })
    const unit = world.create()
    const at: [number, number, number] = [center.x, 0, center.z]
    const files = layout.rows[0].length
    const ranks = layout.rows.length
    const type = army[i]
    world.add(unit, Unit, { type, faction, center: at, destination: at, facing, files, ranks })
    for (const row of layout.rows) {
      for (const slot of row) {
        spawnSoldier(world, unit, type, faction, slotToWorld(center, facing, slot, position), facing, slot)
      }
    }
  })
}

export const UnitsPlugin: Plugin = {
  name: 'RtsUnits',
  dependencies: [WorldPlugin],
  recovery: 'stateless',
  components: [Unit, Selected, AttackOrder, Soldier, MoveTarget, SoldierAnimation, SoldierGlow, Combatant],
  systems: [UnitSystem, MoveSystem, SeparationSystem, TerrainContactSystem, AnimationSystem, GlowSystem, LodDebugSystem],
  async initialize(world) {
    await loadSoldierModels(world)
    for (const faction of Object.values(FactionId)) spawnArmy(world, faction)
  },
}
