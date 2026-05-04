import { Layer, Project, PublishConfig } from '@/types'
import { compileTriggerImage, CompileProgress } from '@/utils/MindARCompiler'
import { uploadFile, fileToBase64 } from '@/utils/WorkerClient'

const BASE_URL = 'https://sergeam09.github.io/ara'

export class Publisher {
  private listeners: ((event: PublishEvent) => void)[] = []

  async publishProject(
    project: Project,
    projectName: string,
    onProgress?: (event: PublishEvent) => void
  ): Promise<string> {
    const events: PublishEvent[] = []

    const emit = (event: PublishEvent) => {
      events.push(event)
      if (onProgress) onProgress(event)
      this.listeners.forEach(listener => listener(event))
    }

    try {
      const modo = project.modo || 'image'

      // Validation
      if (modo === 'image' && !project.trigger) {
        throw new Error('No trigger image selected')
      }

      const validLayers = project.layers.filter(l => l.file || l.type === 'texto')
      if (validLayers.length === 0) {
        throw new Error('Add at least one layer with a file or text')
      }

      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      emit({ type: 'progress', message: 'Starting publication...', percent: 5 })

      let triggerExt = 'jpg'
      if (modo === 'image' && project.trigger) {
        // 1. Compile trigger
        emit({ type: 'progress', message: 'Compiling trigger image...', percent: 10 })
        const mindData = await compileTriggerImage(project.trigger, (progress: CompileProgress) => {
          emit({ type: 'progress', message: 'Compiling trigger...', percent: 10 + progress.percent * 0.15 })
        })
        emit({ type: 'progress', message: '✓ Trigger compiled', percent: 25 })

        // 2. Upload trigger
        emit({ type: 'progress', message: 'Uploading trigger image...', percent: 30 })
        triggerExt = project.trigger.name.split('.').pop()?.toLowerCase() || 'jpg'
        const triggerB64 = await fileToBase64(project.trigger)
        await uploadFile(`proyectos/${slug}/trigger.${triggerExt}`, triggerB64, 'trigger image')
        emit({ type: 'progress', message: '✓ Trigger uploaded', percent: 40 })

        // 3. Upload mind file
        emit({ type: 'progress', message: 'Uploading compiled trigger...', percent: 45 })
        await uploadFile(`proyectos/${slug}/trigger.mind`, mindData, 'compiled trigger')
        emit({ type: 'progress', message: '✓ Compiled trigger uploaded', percent: 55 })
      }

      // 4. Upload layers
      emit({ type: 'progress', message: 'Uploading layers...', percent: modo === 'world' ? 10 : 60 })
      const capasConfig: PublishConfig['capas'] = []

      for (let i = 0; i < validLayers.length; i++) {
        const layer = validLayers[i]
        if (layer.file) {
          const ext = layer.file.name.split('.').pop()?.toLowerCase() || 'bin'
          const b64 = await fileToBase64(layer.file)
          await uploadFile(`proyectos/${slug}/layer-${i}.${ext}`, b64, `layer ${i}`)

          capasConfig.push({
            id: i,
            tipo: layer.type,
            archivo: `layer-${i}.${ext}`,
            aspectRatio: (layer.naturalWidth && layer.naturalHeight)
              ? layer.naturalWidth / layer.naturalHeight
              : undefined,
            posX: layer.posX * 0.5,
            posY: layer.posY * 0.5,
            posZ: layer.posZ || 0,
            rotX: layer.type === 'glb' ? (layer.rotX || 0) - 90 : -(layer.rotX || 0),
            rotY: layer.rotY || 0,
            rotZ: layer.rotZ || 0,
            escala: layer.scale,
            opacidad: layer.opacity,
            entrada: layer.animation,
            animDuration: layer.animationDuration,
            animDelay: layer.animationDelay,
            animAmplitude: layer.animationAmplitude,
            animationAxis: layer.animationAxis,
            delay: 0,
            loop: true
          })
        } else if (layer.type === 'texto') {
          capasConfig.push({
            id: i,
            tipo: 'texto',
            archivo: '',
            texto: layer.texto || 'Texto AR',
            colorTexto: layer.colorTexto || '#ffffff',
            tamanoTexto: layer.tamanoTexto ?? 0.5,
            extrusionDepth: layer.extrusionDepth ?? 0,
            font: layer.fontTexto || 'roboto',
            posX: layer.posX * 0.5,
            posY: layer.posY * 0.5,
            posZ: layer.posZ || 0,
            rotX: -(layer.rotX || 0),
            rotY: layer.rotY || 0,
            rotZ: layer.rotZ || 0,
            escala: layer.scale,
            opacidad: layer.opacity,
            entrada: layer.animation,
            animDuration: layer.animationDuration,
            animDelay: layer.animationDelay,
            animAmplitude: layer.animationAmplitude,
            animationAxis: layer.animationAxis,
            delay: 0,
            loop: true
          })
        }
      }

      emit({ type: 'progress', message: `✓ ${validLayers.length} layers uploaded`, percent: modo === 'world' ? 70 : 75 })

      // 5. Generate and upload config
      emit({ type: 'progress', message: 'Generating configuration...', percent: 80 })
      const config: PublishConfig = {
        modo,
        trigger: modo === 'image' ? `trigger.${triggerExt}` : '',
        mind: modo === 'image' ? 'trigger.mind' : '',
        anchoReal: project.anchoReal || 21,
        altoReal: project.altoReal || 29.7,
        unidad: 'cm',
        capas: capasConfig
      }

      const configB64 = btoa(JSON.stringify(config, null, 2))
      await uploadFile(`proyectos/${slug}/config.json`, configB64, 'configuration')
      emit({ type: 'progress', message: '✓ Configuration uploaded', percent: 90 })

      // 6. Success
      emit({ type: 'progress', message: '✓ Publication complete!', percent: 100 })

      const viewerUrl = `${BASE_URL}/viewer.html?p=${slug}`
      emit({ type: 'success', message: 'Project published successfully', url: viewerUrl })

      return viewerUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      emit({ type: 'error', message })
      throw error
    }
  }

  subscribe(listener: (event: PublishEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
}

export type PublishEvent =
  | { type: 'progress'; message: string; percent: number }
  | { type: 'success'; message: string; url: string }
  | { type: 'error'; message: string }
