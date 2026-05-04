import { getImageDimensions } from '@/utils/ImageDimensions';
export class TriggerUploader {
    constructor() {
        Object.defineProperty(this, "triggerFile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "triggerDimensions", {
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
    async handleFile(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Please select a valid image file');
        }
        try {
            const dimensions = await getImageDimensions(file);
            this.triggerFile = file;
            this.triggerDimensions = dimensions;
            this.notify();
            return { file, dimensions };
        }
        catch (error) {
            throw new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getTriggerFile() {
        return this.triggerFile;
    }
    getTriggerDimensions() {
        return this.triggerDimensions;
    }
    getTriggerDataURL() {
        if (!this.triggerFile)
            return null;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(this.triggerFile);
        });
    }
    clear() {
        this.triggerFile = null;
        this.triggerDimensions = null;
        this.notify();
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notify() {
        this.listeners.forEach(listener => listener(this.triggerFile, this.triggerDimensions));
    }
}
