export class LayerManager {
    constructor() {
        Object.defineProperty(this, "layers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "nextId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "activeLayerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    addLayer(type) {
        const layer = {
            id: `layer_${this.nextId++}`,
            type,
            posX: 0,
            posY: 0,
            posZ: 0,
            scale: 1,
            opacity: 1
        };
        if (type === 'texto') {
            layer.texto = 'Texto AR';
            layer.colorTexto = '#ffffff';
            layer.tamanoTexto = 0.5;
            layer.alignTexto = 'center';
        }
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.notify();
        return layer;
    }
    deleteLayer(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1)
            return;
        this.layers.splice(index, 1);
        if (this.activeLayerId === id) {
            this.activeLayerId = this.layers.length > 0 ? this.layers[Math.max(0, index - 1)].id : null;
        }
        this.notify();
    }
    updateLayer(id, updates) {
        const layer = this.layers.find(l => l.id === id);
        if (!layer)
            return;
        Object.assign(layer, updates);
        this.notify();
    }
    selectLayer(id) {
        if (this.layers.some(l => l.id === id)) {
            this.activeLayerId = id;
            this.notify();
        }
    }
    getLayer(id) {
        return this.layers.find(l => l.id === id);
    }
    getActiveLayer() {
        return this.activeLayerId ? this.layers.find(l => l.id === this.activeLayerId) : undefined;
    }
    getAllLayers() {
        return [...this.layers];
    }
    getActiveLayerId() {
        return this.activeLayerId;
    }
    clear() {
        this.layers = [];
        this.activeLayerId = null;
        this.notify();
    }
    setLayers(layers) {
        this.layers = [...layers];
        this.nextId = Math.max(...layers.map(l => parseInt(l.id.split('_')[1]) || 0)) + 1;
        this.activeLayerId = layers.length > 0 ? layers[0].id : null;
        this.notify();
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notify() {
        this.listeners.forEach(listener => listener(this.layers, this.activeLayerId));
    }
}
