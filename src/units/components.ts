import { component, entity, f32, i32, u32, vec3 } from '@dylanebert/shallot'

/** `type` is a `UnitTypeId`, `faction` a `FactionId`. */
export const Unit = component('Unit', {
  type: u32,
  faction: u32,
  center: vec3,
  destination: vec3,
  facing: f32,
  files: u32,
  ranks: u32,
})
export const Selected = component('Selected', {})
/** On a unit ordered to attack the enemy unit `target`; see `attack.ts`. */
export const AttackOrder = component('AttackOrder', { target: entity })
/** On a unit ordered together with slower units: the metres per second it marches at until its next order. */
export const MarchSpeed = component('MarchSpeed', { speed: f32 })
export const Soldier = component('Soldier', { unit: entity, slotX: f32, slotZ: f32 })
export const MoveTarget = component('MoveTarget', { x: f32, z: f32, heading: f32 })
/** `frame` is the shown run frame, or -1 while idle. */
export const SoldierAnimation = component('SoldierAnimation', {
  phase: f32,
  cycleLength: f32,
  lastX: f32,
  lastZ: f32,
  frame: i32,
})
/** `cooldown` is the seconds until the soldier's next blow or shot. */
export const Combatant = component('Combatant', { health: f32, cooldown: f32 })
/** The entity drawing this soldier's glowing parts (see `glow.ts`). */
export const SoldierGlow = component('SoldierGlow', { entity: entity })
