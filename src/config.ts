export interface MeleeStats {
  /** Health taken from the enemy soldier per blow. */
  damage: number
  /** Seconds between blows. */
  interval: number
}

export interface RangedStats {
  /** Metres from a soldier to the enemy soldier it fires at. */
  range: number
  /** Health taken from the enemy soldier per hit. */
  damage: number
  /** Seconds between shots. */
  interval: number
  /** Chance from 0 to 1 that a shot hits. */
  accuracy: number
}

export interface UnitType {
  name: string
  /** Soldiers in a full-strength unit. */
  size: number
  startFiles: number
  /** Metres per second the unit marches as a block. */
  speed: number
  /** GLB of the soldier's baked frames, see `docs/pipeline/soldier-model.md`. */
  model: string
  /** Health of one soldier. */
  health: number
  melee: MeleeStats
  /** Present on unit types that fire lasers. */
  ranged?: RangedStats
}

export const UnitTypeId = { Trooper: 0, Vanguard: 1 } as const
export type UnitTypeId = (typeof UnitTypeId)[keyof typeof UnitTypeId]

export const UNIT_TYPES: Record<UnitTypeId, UnitType> = {
  [UnitTypeId.Trooper]: {
    name: 'Trooper',
    size: 50,
    startFiles: 10,
    speed: 5,
    model: '/models/trooper.glb',
    health: 30,
    melee: { damage: 4, interval: 1.5 },
    ranged: { range: 60, damage: 10, interval: 2.5, accuracy: 0.4 },
  },
  [UnitTypeId.Vanguard]: {
    name: 'Vanguard',
    size: 40,
    startFiles: 10,
    speed: 4,
    model: '/models/vanguard.glb',
    health: 60,
    melee: { damage: 12, interval: 1.2 },
  },
}

/** The starting army both factions field. */
export const ARMY: readonly UnitTypeId[] = [
  ...Array<UnitTypeId>(5).fill(UnitTypeId.Vanguard),
  ...Array<UnitTypeId>(5).fill(UnitTypeId.Trooper),
]

export interface Faction {
  name: string
  /** Units deployed at start, in deployment order: the front line first. */
  army: readonly UnitTypeId[]
  /** Linear RGBA multiplied into the soldier texture so the sides read apart. */
  tint: readonly [number, number, number, number]
  /** sRGB hex color of the faction's laser bolts. */
  laserColor: number
}

export const FactionId = { Blue: 0, Red: 1 } as const
export type FactionId = (typeof FactionId)[keyof typeof FactionId]

/** The two sides; both are player-controlled in the demo. Blue deploys in front of the starting camera. */
export const FACTIONS: Record<FactionId, Faction> = {
  [FactionId.Blue]: { name: 'Blue', army: ARMY, tint: [0.6, 0.75, 1, 1], laserColor: 0x4da6ff },
  [FactionId.Red]: { name: 'Red', army: ARMY, tint: [1, 0.5, 0.45, 1], laserColor: 0xff3b30 },
}
/** Metres between the two armies' centers at deployment. */
export const ARMY_DISTANCE = 400
export const SOLDIER_COUNT = Object.values(FACTIONS).reduce(
  (sum: number, faction) => sum + faction.army.reduce((size: number, type) => size + UNIT_TYPES[type].size, 0),
  0,
)
export const UNIT_MIN_FILES = 4
export const UNIT_SPLIT_MIN_SOLDIERS = 9
export const UNIT_GAP = 3
export const UNIT_REFORM_DISTANCE = 2
export const UNIT_DRIFT_DISTANCE = 0.75
/** Soldier run speed as a multiple of its unit's `speed`; above 1 so soldiers can catch up with their slots. */
export const SOLDIER_CATCH_UP = 1.2
/** Radians per second a soldier can turn. */
export const SOLDIER_TURN_SPEED = Math.PI * 3
export const SOLDIER_RADIUS = 0.5
export const SOLDIER_CENTER_HEIGHT = 0.9
export const SOLDIER_LOD_DISTANCE = 35
export const RUN_CYCLE_LENGTH = 3
export const RUN_CYCLE_JITTER = 0.15
export const RUN_MIN_SPEED = 1
export const FORMATION_SPACING = 1.5
/** Metres beyond body contact a soldier's melee blows reach. */
export const MELEE_REACH = 0.6
/** Metres from its slot a halted melee soldier looks for an enemy to close with. */
export const MELEE_SEEK_RADIUS = 5
/** Each blow or shot waits its interval times a random factor within ±this, so soldiers don't act in lockstep. */
export const ATTACK_JITTER = 0.25
/** Metres a missed laser bolt lands off its target. */
export const LASER_MISS_SPREAD = 2.5
export const LASER_BOLT = {
  /** Metres per second. */
  speed: 90,
  /** Metres from the bolt's head to its tail. */
  length: 2.5,
  /** Screen pixels. */
  width: 3,
  /** Metres above the soldier's feet the bolt leaves the carbine. */
  muzzleHeight: 1.35,
}
export const MAP_SIZE = 800
/** Procedural elevation; the map seed comes from `?seed=` in the URL, or is random. */
export const TERRAIN = {
  /** Metres between heightmap samples. */
  cellSize: 2,
  /** Metres from a typical valley floor to a typical hilltop. */
  relief: 40,
  /** Metres across the largest hills. */
  wavelength: 320,
  octaves: 5,
  /** Pixels per side of the ground color texture. */
  textureSize: 512,
}
/** Forests grow where a noise field of this wavelength rises above `threshold` (-1 to 1). */
export const FOREST = { wavelength: 220, threshold: 0.2 }
/** Minimum clear gap between obstacles, wider than a soldier so no two obstacles form a dead end. */
export const OBSTACLE_GAP = SOLDIER_RADIUS * 2 + 0.4
/** No obstacles within this many metres of either army's deployment center. */
export const DEPLOY_CLEAR_RADIUS = 60

export const PropShape = { Rock: 0, Pine: 1 } as const
export type PropShape = (typeof PropShape)[keyof typeof PropShape]

export interface PropType {
  name: string
  shape: PropShape
  /** Collision radius range in metres; the mesh scales with it. */
  radius: readonly [number, number]
  /** Metres between scatter candidates. */
  spacing: number
  /** Chance a candidate spawns in open ground. */
  density: number
  /** Chance a candidate spawns inside a forest. */
  forestDensity: number
}

/** Scattered obstacles, placed in table order: earlier entries claim space first. */
export const PROP_TYPES: readonly PropType[] = [
  { name: 'Boulder', shape: PropShape.Rock, radius: [1.8, 3.5], spacing: 30, density: 0.3, forestDensity: 0.15 },
  { name: 'Rock', shape: PropShape.Rock, radius: [0.5, 1.2], spacing: 12, density: 0.12, forestDensity: 0.2 },
  { name: 'Pine', shape: PropShape.Pine, radius: [0.25, 0.4], spacing: 4.5, density: 0.01, forestDensity: 0.6 },
]

export const CAMERA = {
  minDistance: 10,
  maxDistance: 250,
  pitch: Math.PI / 2 - 0.9,
  yaw: Math.PI / 4,
  panSpeed: 1.2,
  rotateSpeed: 2,
  edgePanPx: 12,
}
export const DRAG_THRESHOLD_PX = 4
export const CLICK_SELECT_RADIUS_PX = 20
export const DOUBLE_CLICK_MS = 300
export const SELECTION_RING = {
  radius: 0.55,
  lift: 0.03,
  segments: 24,
  width: 2,
  color: 0x5cff7a,
}

export const KEYS = {
  panForward: ['KeyW', 'ArrowUp'],
  panBack: ['KeyS', 'ArrowDown'],
  panLeft: ['KeyA', 'ArrowLeft'],
  panRight: ['KeyD', 'ArrowRight'],
  rotateLeft: ['KeyQ'],
  rotateRight: ['KeyE'],
  selectAll: ['KeyA'],
  split: ['KeyX'],
  join: ['KeyC'],
  lodDebug: ['KeyL'],
  ctrl: ['ControlLeft', 'ControlRight'],
  shift: ['ShiftLeft', 'ShiftRight'],
} satisfies Record<string, readonly string[]>
