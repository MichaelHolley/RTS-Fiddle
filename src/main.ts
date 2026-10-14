import './style.css'
import { Color4, Engine, Scene } from '@babylonjs/core'
import { RtsCamera } from './camera/RtsCamera'
import { createWorld } from './scene/createWorld'

const canvas = document.getElementById('game') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
scene.clearColor = new Color4(0.06, 0.07, 0.09, 1)

new RtsCamera(scene, canvas)

createWorld(scene)

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
