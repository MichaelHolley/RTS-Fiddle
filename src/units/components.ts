import { component, entity, f32, u32, vec3 } from '@dylanebert/shallot'

export const Unit = component('Unit', { center: vec3, destination: vec3, facing: f32, files: u32, ranks: u32 })
export const Selected = component('Selected', {})
export const Soldier = component('Soldier', { unit: entity, slotX: f32, slotZ: f32 })
export const MoveTarget = component('MoveTarget', { x: f32, z: f32, heading: f32 })
export const SoldierAnimation = component('SoldierAnimation', { phase: f32, cycleLength: f32, lastX: f32, lastZ: f32 })
