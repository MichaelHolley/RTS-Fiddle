const GAME_CTRL_CODES = /^(Digit\d|KeyA)$/

/** Stops the browser from acting on Ctrl shortcuts the game uses (tab switching, select page text). */
export function blockBrowserShortcuts(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey && !event.altKey && GAME_CTRL_CODES.test(event.code)) event.preventDefault()
  }
  window.addEventListener('keydown', onKeyDown, { capture: true })
  return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
}
