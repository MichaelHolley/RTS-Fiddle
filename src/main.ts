import './style.css'
import { runApp, shallotDark } from '@dylanebert/shallot'
import { RtsPlugin } from './app'

const bootstrap = document.querySelector<HTMLElement>('[data-shallot-bootstrap]') ?? undefined
await runApp({ plugins: [RtsPlugin], loading: shallotDark({ bootstrap }) })
