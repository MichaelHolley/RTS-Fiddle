import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core'
import type { LinesMesh, Scene } from '@babylonjs/core'
import type { SlotOffset } from '../units/Formation'

const LIFT = 0.05
const COLOR = new Color3(1, 0.9, 0.2)
const MARKER_TIP = 0.35
const MARKER_BACK = 0.2
const MARKER_HALF_WIDTH = 0.25

export function createSlotMarkers(scene: Scene, slots: Iterable<SlotOffset>): LinesMesh {
  const lines = Array.from(slots, slotMarker)

  const markers = MeshBuilder.CreateLineSystem('formationSlotMarkers', { lines }, scene)
  markers.color = COLOR
  markers.isPickable = false
  return markers
}

export function placeSlotMarkers(markers: LinesMesh, center: Vector3, facing: number): void {
  markers.position.set(center.x, center.y + LIFT, center.z)
  markers.rotation.y = facing
}

function slotMarker({ x, z }: SlotOffset): Vector3[] {
  const tip = point(x, z + MARKER_TIP)
  return [tip, point(x + MARKER_HALF_WIDTH, z - MARKER_BACK), point(x - MARKER_HALF_WIDTH, z - MARKER_BACK), tip]
}

function point(x: number, z: number): Vector3 {
  return new Vector3(x, 0, z)
}
