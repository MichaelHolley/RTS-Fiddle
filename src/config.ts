export interface UnitType {
  name: string
  /** Soldiers in a full-strength unit. */
  size: number
  startFiles: number
  /** Metres per second the unit marches as a block. */
  speed: number
  /** GLB of the soldier's baked frames, see `docs/pipeline/soldier-model.md`. */
  model: string
}

export const UnitTypeId = { Trooper: 0, Vanguard: 1 } as const
export type UnitTypeId = (typeof UnitTypeId)[keyof typeof UnitTypeId]

export const UNIT_TYPES: Record<UnitTypeId, UnitType> = {
  [UnitTypeId.Trooper]: { name: 'Trooper', size: 50, startFiles: 10, speed: 5, model: '/models/trooper.glb' },
  [UnitTypeId.Vanguard]: { name: 'Vanguard', size: 40, startFiles: 10, speed: 4, model: '/models/vanguard.glb' },
}

/** Units deployed at start, in deployment order: the front line first. */
export const ARMY: readonly UnitTypeId[] = [
  ...Array<UnitTypeId>(5).fill(UnitTypeId.Vanguard),
  ...Array<UnitTypeId>(5).fill(UnitTypeId.Trooper),
]
export const SOLDIER_COUNT = ARMY.reduce((sum: number, type) => sum + UNIT_TYPES[type].size, 0)
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
/** No obstacles within this many metres of the map center, where the army deploys. */
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
