import { Vector3 } from '@babylonjs/core'
import type { AbstractMesh, Scene } from '@babylonjs/core'
import type { RtsCamera } from '../camera/RtsCamera'
import type { MoveMarker } from '../ui/MoveMarker'
import type { Unit } from '../units/Unit'
import type { UnitManager } from '../units/UnitManager'
import { Formation } from '../units/Formation'
import { assignSlots, squareLayout } from './formation'

const RIGHT_BUTTON = 2

export class CommandController {
  private readonly scene: Scene
  private readonly ground: AbstractMesh
  private readonly rtsCamera: RtsCamera
  private readonly unitManager: UnitManager
  private readonly moveMarker: MoveMarker

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    ground: AbstractMesh,
    rtsCamera: RtsCamera,
    unitManager: UnitManager,
    moveMarker: MoveMarker,
  ) {
    this.scene = scene
    this.ground = ground
    this.rtsCamera = rtsCamera
    this.unitManager = unitManager
    this.moveMarker = moveMarker

    canvas.addEventListener('pointerdown', this.onPointerDown)
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== RIGHT_BUTTON || this.rtsCamera.isRotating) return
    const selected = this.unitManager.selected()
    if (selected.length === 0) return

    const pick = this.scene.pick(e.offsetX, e.offsetY, (mesh) => mesh === this.ground)
    const destination = pick.pickedPoint
    if (!pick.hit || !destination) return

    const centroid = centroidOf(selected)
    const facing = Math.atan2(destination.x - centroid.x, destination.z - centroid.z)
    const layout = squareLayout(selected.length)
    const slots = assignSlots(selected, layout, facing)
    this.unitManager.issueMove(new Formation(centroid, destination, facing, layout.width, layout.depth, slots))
    this.moveMarker.play(destination)
  }
}

function centroidOf(units: readonly Unit[]): Vector3 {
  const sum = new Vector3()
  for (const unit of units) sum.addInPlace(unit.position)
  return sum.scaleInPlace(1 / units.length)
}
