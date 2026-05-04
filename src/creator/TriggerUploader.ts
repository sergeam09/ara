import { getImageDimensions, ImageDimensions } from '@/utils/ImageDimensions'

export class TriggerUploader {
  private triggerFile: File | null = null
  private triggerDimensions: ImageDimensions | null = null
  private listeners: ((file: File | null, dimensions: ImageDimensions | null) => void)[] = []

  async handleFile(file: File): Promise<{ file: File; dimensions: ImageDimensions }> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select a valid image file')
    }

    try {
      const dimensions = await getImageDimensions(file)
      this.triggerFile = file
      this.triggerDimensions = dimensions
      this.notify()

      return { file, dimensions }
    } catch (error) {
      throw new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  getTriggerFile(): File | null {
    return this.triggerFile
  }

  getTriggerDimensions(): ImageDimensions | null {
    return this.triggerDimensions
  }

  getTriggerDataURL(): Promise<string> | null {
    if (!this.triggerFile) return null

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(this.triggerFile!)
    })
  }

  clear(): void {
    this.triggerFile = null
    this.triggerDimensions = null
    this.notify()
  }

  subscribe(listener: (file: File | null, dimensions: ImageDimensions | null) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.triggerFile, this.triggerDimensions))
  }
}
