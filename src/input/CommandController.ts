import { Vector3 } from '@babylonjs/core'
import type { AbstractMesh, Scene } from '@babylonjs/core'
import { DRAG_THRESHOLD_PX } from '../config'
import type { RtsCamera } from '../camera/RtsCamera'
import type { FormationPreview } from '../ui/FormationPreview'
import type { MoveMarker } from '../ui/MoveMarker'
import { Formation } from '../units/Formation'
import type { Unit } from '../units/Unit'
import type { UnitManager } from '../units/UnitManager'
import { assignSlots, planLine, planSquare } from './formation'
import type { FormationPlan } from './formation'

const RIGHT_BUTTON = 2

interface Drag {
  pointerId: number
  startX: number
  startY: number
  anchor: Vector3
  plan: FormationPlan | null
}

export class CommandController {
  private readonly scene: Scene
  private readonly canvas: HTMLCanvasElement
  private readonly ground: AbstractMesh
  private readonly rtsCamera: RtsCamera
  private readonly unitManager: UnitManager
  private readonly moveMarker: MoveMarker
  private readonly preview: FormationPreview
  private drag: Drag | null = null

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    ground: AbstractMesh,
    rtsCamera: RtsCamera,
    unitManager: UnitManager,
    moveMarker: MoveMarker,
    preview: FormationPreview,
  ) {
    this.scene = scene
    this.canvas = canvas
    this.ground = ground
    this.rtsCamera = rtsCamera
    this.unitManager = unitManager
    this.moveMarker = moveMarker
    this.preview = preview

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== RIGHT_BUTTON || this.rtsCamera.isRotating || this.drag) return
    if (this.unitManager.selectedCount === 0) return
    const anchor = this.pickGround(e)
    if (!anchor) return
    this.canvas.setPointerCapture(e.pointerId)
    this.drag = { pointerId: e.pointerId, startX: e.offsetX, startY: e.offsetY, anchor, plan: null }
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const { drag } = this
    if (!drag || e.pointerId !== drag.pointerId) return
    if (!drag.plan && Math.hypot(e.offsetX - drag.startX, e.offsetY - drag.startY) <= DRAG_THRESHOLD_PX) return
    const end = this.pickGround(e)
    if (!end) return
    drag.plan = planLine(drag.anchor, end, this.unitManager.selectedCount)
    this.preview.show(drag.plan)
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    const { drag } = this
    if (e.button !== RIGHT_BUTTON || !drag || e.pointerId !== drag.pointerId) return
    this.endDrag()

    const selected = this.unitManager.selected()
    if (selected.length === 0) return
    const centroid = centroidOf(selected)
    const plan = drag.plan ?? planSquare(centroid, drag.anchor, selected.length)
    const slots = assignSlots(selected, plan.layout, plan.facing)
    const { layout, center, facing } = plan
    this.unitManager.issueMove(new Formation(centroid, center, facing, layout.width, layout.depth, slots))
    if (!drag.plan) this.moveMarker.play(drag.anchor)
  }

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.drag?.pointerId) this.endDrag()
  }

  private endDrag(): void {
    this.drag = null
    this.preview.hide()
  }

  private pickGround(e: PointerEvent): Vector3 | null {
    const pick = this.scene.pick(e.offsetX, e.offsetY, (mesh) => mesh === this.ground)
    return pick.hit ? pick.pickedPoint : null
  }
}

function centroidOf(units: readonly Unit[]): Vector3 {
  const sum = new Vector3()
  for (const unit of units) sum.addInPlace(unit.position)
  return sum.scaleInPlace(1 / units.length)
}
