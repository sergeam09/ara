import { calculateGridDimensions } from '@/utils/ImageDimensions';
export class GridSystem {
    constructor() {
        Object.defineProperty(this, "gridDimensions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "visible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    setImageRatio(ratio, baseWidth = 150) {
        this.gridDimensions = calculateGridDimensions(ratio, baseWidth);
        this.notify();
    }
    getGridDimensions() {
        return this.gridDimensions;
    }
    toggleVisibility() {
        this.visible = !this.visible;
        this.notify();
    }
    isVisible() {
        return this.visible;
    }
    generateGridLines() {
        if (!this.gridDimensions)
            return { x: [], y: [] };
        const { width, height, cellSize } = this.gridDimensions;
        const xLines = [];
        const yLines = [];
        for (let x = -width / 2; x <= width / 2; x += cellSize) {
            xLines.push(x);
        }
        for (let y = 0; y <= height; y += cellSize) {
            yLines.push(y);
        }
        return { x: xLines, y: yLines };
    }
    getGridInfoHTML() {
        if (!this.gridDimensions) {
            return '<div style="color: #666; padding: 12px; text-align: center; font-size: 10px;">No grid loaded</div>';
        }
        const { ratio, width, height } = this.gridDimensions;
        return `
      <div style="padding: 12px; font-size: 9px; line-height: 1.8;">
        <div><strong>Grid Ratio:</strong> <span style="color: var(--a);">${ratio.toFixed(2)}</span></div>
        <div><strong>Dimensions:</strong> <span style="color: var(--a);">${width.toFixed(1)} × ${height.toFixed(1)}</span></div>
      </div>
    `;
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notify() {
        this.listeners.forEach(listener => listener(this.gridDimensions));
    }
}
