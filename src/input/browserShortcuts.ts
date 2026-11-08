const ALWAYS_ALLOWED = new Set(['F5', 'F11', 'F12'])
const CTRL_SHIFT_ALLOWED = new Set(['KeyI', 'KeyJ', 'KeyC'])

// Reload, fullscreen and dev tools stay usable; Cmd combos are left alone since the game never binds Meta
function isAllowed(event: KeyboardEvent): boolean {
  if (event.metaKey || ALWAYS_ALLOWED.has(event.code)) return true
  if (!event.ctrlKey || event.altKey) return false
  return event.code === 'KeyR' || (event.shiftKey && CTRL_SHIFT_ALLOWED.has(event.code))
}

/** Cancels the browser's own handling of every key except a small allowlist, so game hotkeys always win. */
export function blockBrowserShortcuts(): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (!isAllowed(event)) event.preventDefault()
  }
  // keyup too: a lone Alt press opens the browser menu on release
  window.addEventListener('keydown', onKey, { capture: true })
  window.addEventListener('keyup', onKey, { capture: true })
  return () => {
    window.removeEventListener('keydown', onKey, { capture: true })
    window.removeEventListener('keyup', onKey, { capture: true })
  }
}
