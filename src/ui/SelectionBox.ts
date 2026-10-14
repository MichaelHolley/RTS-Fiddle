export class SelectionBox {
  private readonly element: HTMLElement

  constructor(element: HTMLElement) {
    this.element = element
  }

  show(x0: number, y0: number, x1: number, y1: number): void {
    const { style } = this.element
    style.left = `${Math.min(x0, x1)}px`
    style.top = `${Math.min(y0, y1)}px`
    style.width = `${Math.abs(x1 - x0)}px`
    style.height = `${Math.abs(y1 - y0)}px`
    style.display = 'block'
  }

  hide(): void {
    this.element.style.display = 'none'
  }
}
