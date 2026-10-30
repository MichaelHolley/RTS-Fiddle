import { Devices, Viewports } from '@dylanebert/shallot'
import type { Plugin, System, World } from '@dylanebert/shallot'
import { Orbit, OrbitPlugin } from '@dylanebert/shallot/extras'
import { CAMERA, MAP_SIZE } from '../config'
import { RtsView, WorldPlugin } from '../scene/world'

const HALF_MAP = MAP_SIZE / 2
const ZOOM_STEP = 0.1
const DRAG_ROTATE_SPEED = 0.005

const FORWARD_KEYS = ['KeyW', 'ArrowUp']
const BACK_KEYS = ['KeyS', 'ArrowDown']
const RIGHT_KEYS = ['KeyD', 'ArrowRight']
const LEFT_KEYS = ['KeyA', 'ArrowLeft']

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

function axis(
  held: ReadonlySet<string>,
  positive: string[],
  negative: string[],
  edgePositive: boolean,
  edgeNegative: boolean,
): number {
  const plus = edgePositive || positive.some((code) => held.has(code))
  const minus = edgeNegative || negative.some((code) => held.has(code))
  return Number(plus) - Number(minus)
}

function updateCamera(world: World): void {
  const { keys, pointer } = world.resource(Devices)
  const orbit = world.storage(Orbit)
  const eid = world.resource(RtsView).camera
  const dt = world.time.deltaTime

  let yaw = orbit.yaw.get(eid)
  yaw += (Number(keys.held.has('KeyE')) - Number(keys.held.has('KeyQ'))) * CAMERA.rotateSpeed * dt
  if (pointer.middle) yaw -= pointer.deltaX * DRAG_ROTATE_SPEED

  if (pointer.scroll !== 0) {
    const distance = orbit.distance.get(eid) * (1 + Math.sign(pointer.scroll) * ZOOM_STEP)
    orbit.distance.set(eid, clamp(distance, CAMERA.minDistance, CAMERA.maxDistance))
  }

  const view = pointer.hover && !pointer.middle ? world.resource(Viewports).get(0) : undefined
  const forwardAmount = axis(
    keys.held,
    FORWARD_KEYS,
    BACK_KEYS,
    view !== undefined && pointer.y < CAMERA.edgePanPx,
    view !== undefined && pointer.y > view.cssHeight - CAMERA.edgePanPx,
  )
  const rightAmount = axis(
    keys.held,
    RIGHT_KEYS,
    LEFT_KEYS,
    view !== undefined && pointer.x > view.cssWidth - CAMERA.edgePanPx,
    view !== undefined && pointer.x < CAMERA.edgePanPx,
  )

  let panX = orbit.pan.x.get(eid)
  let panZ = orbit.pan.z.get(eid)
  if (forwardAmount !== 0 || rightAmount !== 0) {
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    // Orbit places the camera at (sin yaw, cos yaw) from the target: forward = -(sin, cos), right = forward x up
    const moveX = -sin * forwardAmount + cos * rightAmount
    const moveZ = -cos * forwardAmount - sin * rightAmount
    const scale = (CAMERA.panSpeed * orbit.distance.get(eid) * dt) / Math.hypot(moveX, moveZ)
    panX += moveX * scale
    panZ += moveZ * scale
  }

  orbit.yaw.set(eid, yaw)
  orbit.pan.set(eid, clamp(panX, -HALF_MAP, HALF_MAP), 0, clamp(panZ, -HALF_MAP, HALF_MAP))
}

const RtsCameraSystem: System = {
  name: 'control',
  group: 'setup',
  update: updateCamera,
}

export const RtsCameraPlugin: Plugin = {
  name: 'RtsCamera',
  dependencies: [OrbitPlugin, WorldPlugin],
  systems: [RtsCameraSystem],
}
