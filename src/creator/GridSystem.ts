import { GridDimensions } from '@/types'
import { calculateGridDimensions } from '@/utils/ImageDimensions'

export class GridSystem {
  private gridDimensions: GridDimensions | null = null
  private visible: boolean = true
  private listeners: ((grid: GridDimensions | null) => void)[] = []

  setImageRatio(ratio: number, baseWidth: number = 150): void {
    this.gridDimensions = calculateGridDimensions(ratio, baseWidth)
    this.notify()
  }

  getGridDimensions(): GridDimensions | null {
    return this.gridDimensions
  }

  toggleVisibility(): void {
    this.visible = !this.visible
    this.notify()
  }

  isVisible(): boolean {
    return this.visible
  }

  generateGridLines(): { x: number[]; y: number[] } {
    if (!this.gridDimensions) return { x: [], y: [] }

    const { width, height, cellSize } = this.gridDimensions
    const xLines: number[] = []
    const yLines: number[] = []

    for (let x = -width / 2; x <= width / 2; x += cellSize) {
      xLines.push(x)
    }

    for (let y = 0; y <= height; y += cellSize) {
      yLines.push(y)
    }

    return { x: xLines, y: yLines }
  }

  getGridInfoHTML(): string {
    if (!this.gridDimensions) {
      return '<div style="color: #666; padding: 12px; text-align: center; font-size: 10px;">No grid loaded</div>'
    }

    const { ratio, width, height } = this.gridDimensions
    return `
      <div style="padding: 12px; font-size: 9px; line-height: 1.8;">
        <div><strong>Grid Ratio:</strong> <span style="color: var(--a);">${ratio.toFixed(2)}</span></div>
        <div><strong>Dimensions:</strong> <span style="color: var(--a);">${width.toFixed(1)} × ${height.toFixed(1)}</span></div>
      </div>
    `
  }

  subscribe(listener: (grid: GridDimensions | null) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.gridDimensions))
  }
}
