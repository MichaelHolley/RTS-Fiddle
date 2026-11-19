import type { Plugin } from '@dylanebert/shallot'
import { LinesPlugin } from '@dylanebert/shallot/extras'
import { UnitsPlugin } from '../units/units'
import { BoltDrawSystem, BoltSystem } from './bolts'
import { DeathSystem } from './death'
import { EngagementSystem } from './engagement'
import { RangedSystem } from './ranged'

/** Melee, laser fire and casualties, run each fixed tick between unit planning and soldier movement. */
export const CombatPlugin: Plugin = {
  name: 'RtsCombat',
  dependencies: [UnitsPlugin, LinesPlugin],
  recovery: 'stateless',
  systems: [EngagementSystem, BoltSystem, RangedSystem, DeathSystem, BoltDrawSystem],
}
