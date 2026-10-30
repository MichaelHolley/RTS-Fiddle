import type { Plugin } from '@dylanebert/shallot'
import { DiagnosticsOverlayPlugin } from '@dylanebert/shallot/extras'
import { RtsCameraPlugin } from './camera/rtsCamera'
import { CommandPlugin } from './input/commands'
import { SelectionPlugin } from './input/selection'
import { WorldPlugin } from './scene/world'
import { UnitsPlugin } from './units/units'

export const RtsPlugin: Plugin = {
  name: 'Rts',
  dependencies: [WorldPlugin, RtsCameraPlugin, UnitsPlugin, SelectionPlugin, CommandPlugin, DiagnosticsOverlayPlugin],
}
