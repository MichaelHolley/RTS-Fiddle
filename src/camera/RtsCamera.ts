import { ArcRotateCamera, Vector3 } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { CAMERA, MAP_SIZE } from '../config'

const HALF_MAP = MAP_SIZE / 2
const ZOOM_STEP = 0.1
const DRAG_ROTATE_SPEED = 0.005
const MIDDLE_BUTTON = 1

const FORWARD_KEYS = ['KeyW', 'ArrowUp']
const BACK_KEYS = ['KeyS', 'ArrowDown']
const RIGHT_KEYS = ['KeyD', 'ArrowRight']
const LEFT_KEYS = ['KeyA', 'ArrowLeft']

export class RtsCamera {
  readonly camera: ArcRotateCamera

  private readonly canvas: HTMLCanvasElement
  private readonly pressed = new Set<string>()
  private readonly forward = new Vector3()
  private readonly right = new Vector3()
  private readonly move = new Vector3()
  private pointerInside = false
  private pointerX = 0
  private pointerY = 0
  private rotating = false

  get isRotating(): boolean {
    return this.rotating
  }

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new ArcRotateCamera(
      'rtsCamera',
      Math.PI / 4,
      CAMERA.beta,
      (CAMERA.minRadius + CAMERA.maxRadius) / 2,
      Vector3.Zero(),
      scene,
    )
    scene.activeCamera = this.camera

    window.addEventListener('keydown', (e) => this.pressed.add(e.code))
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code))
    window.addEventListener('blur', () => {
      this.pressed.clear()
      this.pointerInside = false
    })

    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', () => (this.pointerInside = false))
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)

    scene.onBeforeRenderObservable.add(() => {
      this.update(scene.getEngine().getDeltaTime() / 1000)
    })
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const radius = this.camera.radius * (1 + Math.sign(e.deltaY) * ZOOM_STEP)
    this.camera.radius = Math.min(CAMERA.maxRadius, Math.max(CAMERA.minRadius, radius))
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.pointerInside = true
    this.pointerX = e.offsetX
    this.pointerY = e.offsetY
    if (this.rotating) this.camera.alpha -= e.movementX * DRAG_ROTATE_SPEED
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== MIDDLE_BUTTON) return
    e.preventDefault()
    this.canvas.setPointerCapture(e.pointerId)
    this.rotating = true
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== MIDDLE_BUTTON && e.type !== 'pointercancel') return
    this.rotating = false
  }

  private axis(positive: string[], negative: string[], edgePositive: boolean, edgeNegative: boolean): number {
    const plus = edgePositive || positive.some((code) => this.pressed.has(code))
    const minus = edgeNegative || negative.some((code) => this.pressed.has(code))
    return Number(plus) - Number(minus)
  }

  private update(dt: number): void {
    const { camera, forward, right, move } = this
    const target = camera.target

    const rotation = Number(this.pressed.has('KeyE')) - Number(this.pressed.has('KeyQ'))
    camera.alpha += rotation * CAMERA.rotateSpeed * dt
    camera.beta = CAMERA.beta

    const edge = this.pointerInside && !this.rotating
    const fwdAmount = this.axis(
      FORWARD_KEYS,
      BACK_KEYS,
      edge && this.pointerY < CAMERA.edgePanPx,
      edge && this.pointerY > this.canvas.clientHeight - CAMERA.edgePanPx,
    )
    const rightAmount = this.axis(
      RIGHT_KEYS,
      LEFT_KEYS,
      edge && this.pointerX > this.canvas.clientWidth - CAMERA.edgePanPx,
      edge && this.pointerX < CAMERA.edgePanPx,
    )

    if (fwdAmount !== 0 || rightAmount !== 0) {
      camera.target.subtractToRef(camera.position, forward)
      forward.y = 0
      forward.normalize()
      Vector3.CrossToRef(Vector3.UpReadOnly, forward, right)

      move.copyFromFloats(0, 0, 0)
      move.addInPlace(forward.scaleInPlace(fwdAmount))
      move.addInPlace(right.scaleInPlace(rightAmount))
      move.normalize()
      move.scaleInPlace(CAMERA.panSpeed * camera.radius * dt)

      target.x += move.x
      target.z += move.z
    }

    target.x = Math.min(HALF_MAP, Math.max(-HALF_MAP, target.x))
    target.z = Math.min(HALF_MAP, Math.max(-HALF_MAP, target.z))
    target.y = 0
  }
}
