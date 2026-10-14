import './style.css'
import { Color4, Engine, Scene } from '@babylonjs/core'
import { RtsCamera } from './camera/RtsCamera'
import { SelectionController } from './input/SelectionController'
import { createWorld } from './scene/createWorld'
import { SelectionBox } from './ui/SelectionBox'
import { UnitManager } from './units/UnitManager'

const MAX_FRAME_SECONDS = 0.1

const canvas = document.getElementById('game') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
scene.clearColor = new Color4(0.06, 0.07, 0.09, 1)

const rtsCamera = new RtsCamera(scene, canvas)

createWorld(scene)

const unitManager = new UnitManager(scene)
scene.onBeforeRenderObservable.add(() => {
  unitManager.update(Math.min(engine.getDeltaTime() / 1000, MAX_FRAME_SECONDS))
})

new SelectionController(
  scene,
  canvas,
  rtsCamera,
  unitManager,
  new SelectionBox(document.getElementById('selection-box') as HTMLElement),
)

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

if (import.meta.env.DEV) {
  let inspector: { readonly isDisposed: boolean; dispose(): Promise<void> } | undefined
  window.addEventListener('keydown', async (e) => {
    if (e.code !== 'F9') return
    e.preventDefault()
    if (inspector && !inspector.isDisposed) {
      await inspector.dispose()
      return
    }
    const { ShowInspector } = await import('@babylonjs/inspector')
    inspector = ShowInspector(scene)
  })
}
