import { Matrix, Vector3, Viewport } from '@babylonjs/core'
import type { AbstractEngine, ArcRotateCamera, Scene } from '@babylonjs/core'
import { CLICK_SELECT_RADIUS_PX, DRAG_THRESHOLD_PX } from '../config'
import type { RtsCamera } from '../camera/RtsCamera'
import type { SelectionBox } from '../ui/SelectionBox'
import type { UnitManager } from '../units/UnitManager'

const LEFT_BUTTON = 0

export class SelectionController {
  private readonly canvas: HTMLCanvasElement
  private readonly engine: AbstractEngine
  private readonly scene: Scene
  private readonly camera: ArcRotateCamera
  private readonly rtsCamera: RtsCamera
  private readonly unitManager: UnitManager
  private readonly box: SelectionBox
  private readonly viewport = new Viewport(0, 0, 1, 1)
  private readonly screen = new Vector3()
  private pointerId: number | null = null
  private startX = 0
  private startY = 0
  private currentX = 0
  private currentY = 0
  private dragging = false

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    rtsCamera: RtsCamera,
    unitManager: UnitManager,
    box: SelectionBox,
  ) {
    this.scene = scene
    this.engine = scene.getEngine()
    this.canvas = canvas
    this.camera = rtsCamera.camera
    this.rtsCamera = rtsCamera
    this.unitManager = unitManager
    this.box = box

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== LEFT_BUTTON || this.rtsCamera.isRotating || this.pointerId !== null) return
    this.canvas.setPointerCapture(e.pointerId)
    this.pointerId = e.pointerId
    this.startX = this.currentX = e.offsetX
    this.startY = this.currentY = e.offsetY
    this.dragging = false
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return
    this.currentX = e.offsetX
    this.currentY = e.offsetY
    if (!this.dragging && Math.hypot(this.currentX - this.startX, this.currentY - this.startY) > DRAG_THRESHOLD_PX) {
      this.dragging = true
    }
    if (this.dragging) this.box.show(this.startX, this.startY, this.currentX, this.currentY)
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== LEFT_BUTTON || e.pointerId !== this.pointerId) return
    this.currentX = e.offsetX
    this.currentY = e.offsetY
    const additive = e.shiftKey
    if (this.dragging) this.selectRect(additive)
    else this.selectClick(additive)
    this.endDrag()
  }

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.endDrag()
  }

  private endDrag(): void {
    this.pointerId = null
    this.dragging = false
    this.box.hide()
  }

  private selectRect(additive: boolean): void {
    const minX = Math.min(this.startX, this.currentX)
    const maxX = Math.max(this.startX, this.currentX)
    const minY = Math.min(this.startY, this.currentY)
    const maxY = Math.max(this.startY, this.currentY)
    const ids: number[] = []
    this.forEachScreenPosition((id, x, y) => {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) ids.push(id)
    })
    this.unitManager.setSelection(ids, additive)
  }

  private selectClick(additive: boolean): void {
    let nearestId = -1
    let nearestDistance = CLICK_SELECT_RADIUS_PX
    this.forEachScreenPosition((id, x, y) => {
      const distance = Math.hypot(x - this.currentX, y - this.currentY)
      if (distance > nearestDistance) return
      nearestDistance = distance
      nearestId = id
    })
    if (nearestId >= 0) this.unitManager.setSelection([nearestId], additive)
    else if (!additive) this.unitManager.clearSelection()
  }

  private forEachScreenPosition(visit: (id: number, x: number, y: number) => void): void {
    const { engine, canvas, screen } = this
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    const scaleX = canvas.clientWidth / width
    const scaleY = canvas.clientHeight / height
    this.camera.viewport.toGlobalToRef(width, height, this.viewport)
    const transform = this.scene.getTransformMatrix()

    for (const unit of this.unitManager.units) {
      Vector3.ProjectToRef(unit.position, Matrix.IdentityReadOnly, transform, this.viewport, screen)
      if (screen.z < 0 || screen.z > 1) continue
      visit(unit.id, screen.x * scaleX, screen.y * scaleY)
    }
  }
}
