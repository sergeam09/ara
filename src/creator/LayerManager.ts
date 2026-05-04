import { Layer } from '@/types'

export class LayerManager {
  private layers: Layer[] = []
  private nextId: number = 1
  private activeLayerId: string | null = null
  private listeners: ((layers: Layer[], active: string | null) => void)[] = []

  addLayer(type: Layer['type']): Layer {
    const layer: Layer = {
      id: `layer_${this.nextId++}`,
      type,
      posX: 0,
      posY: 0,
      posZ: 0,
      scale: 1,
      opacity: 1
    }

    if (type === 'texto') {
      layer.texto = 'Texto AR'
      layer.colorTexto = '#ffffff'
      layer.tamanoTexto = 0.5
      layer.alignTexto = 'center'
    }

    this.layers.push(layer)
    this.activeLayerId = layer.id
    this.notify()
    return layer
  }

  deleteLayer(id: string): void {
    const index = this.layers.findIndex(l => l.id === id)
    if (index === -1) return

    this.layers.splice(index, 1)

    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers.length > 0 ? this.layers[Math.max(0, index - 1)].id : null
    }

    this.notify()
  }

  updateLayer(id: string, updates: Partial<Layer>): void {
    const layer = this.layers.find(l => l.id === id)
    if (!layer) return

    Object.assign(layer, updates)
    this.notify()
  }

  selectLayer(id: string): void {
    if (this.layers.some(l => l.id === id)) {
      this.activeLayerId = id
      this.notify()
    }
  }

  getLayer(id: string): Layer | undefined {
    return this.layers.find(l => l.id === id)
  }

  getActiveLayer(): Layer | undefined {
    return this.activeLayerId ? this.layers.find(l => l.id === this.activeLayerId) : undefined
  }

  getAllLayers(): Layer[] {
    return [...this.layers]
  }

  getActiveLayerId(): string | null {
    return this.activeLayerId
  }

  clear(): void {
    this.layers = []
    this.activeLayerId = null
    this.notify()
  }

  setLayers(layers: Layer[]): void {
    this.layers = [...layers]
    this.nextId = Math.max(...layers.map(l => parseInt(l.id.split('_')[1]) || 0)) + 1
    this.activeLayerId = layers.length > 0 ? layers[0].id : null
    this.notify()
  }

  subscribe(listener: (layers: Layer[], active: string | null) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.layers, this.activeLayerId))
  }
}
