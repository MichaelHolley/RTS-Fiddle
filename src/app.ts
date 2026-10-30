import type { Plugin } from '@dylanebert/shallot'
import { DiagnosticsOverlayPlugin } from '@dylanebert/shallot/extras'
import { WorldPlugin } from './scene/world'

export const RtsPlugin: Plugin = {
  name: 'Rts',
  dependencies: [WorldPlugin, DiagnosticsOverlayPlugin],
}
