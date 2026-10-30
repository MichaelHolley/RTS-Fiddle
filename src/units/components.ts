import { component, entity, f32, vec3 } from '@dylanebert/shallot'

export const Unit = component('Unit', {})
export const Selected = component('Selected', {})
export const MoveTarget = component('MoveTarget', { x: f32, z: f32, heading: f32 })
export const Formation = component('Formation', { center: vec3, destination: vec3, facing: f32 })
export const FormationSlot = component('FormationSlot', { formation: entity, x: f32, z: f32 })
