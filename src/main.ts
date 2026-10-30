import './style.css'
import { runApp, shallotDark } from '@dylanebert/shallot'
import { RtsPlugin } from './app'
import { mountUi } from './ui/hud'

const bootstrap = document.querySelector<HTMLElement>('[data-shallot-bootstrap]') ?? undefined
await runApp({ plugins: [RtsPlugin], loading: shallotDark({ bootstrap }), ui: mountUi })
