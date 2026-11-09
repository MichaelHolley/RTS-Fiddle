import { component, entity, f32, i32, u32, vec3 } from '@dylanebert/shallot'

/** `type` is a `UnitTypeId`. */
export const Unit = component('Unit', {
  type: u32,
  center: vec3,
  destination: vec3,
  facing: f32,
  files: u32,
  ranks: u32,
})
export const Selected = component('Selected', {})
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
/** The entity drawing this soldier's glowing parts (see `glow.ts`). */
export const SoldierGlow = component('SoldierGlow', { entity: entity })
