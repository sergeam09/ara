import { TriggerUploader } from './TriggerUploader'
import { LayerManager } from './LayerManager'
import { Preview3D } from './Preview3D'
import { Publisher, PublishEvent } from './Publisher'
import { Layer } from '@/types'

const triggerUploader = new TriggerUploader()
const layerManager = new LayerManager()
const preview3D = new Preview3D()
const publisher = new Publisher()

let triggerWidth = 150
let triggerHeight = 100

const TYPE_ICONS: Record<Layer['type'], string> = {
  image: '◈', video: '▶', gif: '⟳', glb: '⬡', texto: 'T', svg: '⬟'
}

const TYPE_ACCEPT: Record<Layer['type'], string> = {
  image: 'image/jpeg,image/png,image/webp',
  gif:   'image/gif,image/apng',
  video: 'video/mp4,video/webm,video/quicktime',
  glb:   '.glb,.gltf',
  svg:   'image/svg+xml',
  texto: ''
}

// ── Trigger UI ─────────────────────────────────────────────────────────────

function setupTriggerUpload() {
  const zone      = document.getElementById('triggerUploadZone') as HTMLElement
  const fileInput = document.getElementById('fileTrigger') as HTMLInputElement
  const loaded    = document.getElementById('triggerLoaded') as HTMLElement
  const thumb     = document.getElementById('triggerThumb') as HTMLImageElement
  const nameEl    = document.getElementById('triggerName') as HTMLElement
  const btnChange = document.getElementById('btnChangeTrigger') as HTMLElement

  const openPicker = () => fileInput.click()
  zone.addEventListener('click', openPicker)
  btnChange.addEventListener('click', openPicker)

  // Drag & drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)' })
  zone.addEventListener('dragleave', () => { zone.style.borderColor = '' })
  zone.addEventListener('drop', async e => {
    e.preventDefault()
    zone.style.borderColor = ''
    const file = e.dataTransfer?.files[0]
    if (file) await loadTriggerFile(file)
  })

  fileInput.addEventListener('change', async () => {
    if (fileInput.files?.[0]) await loadTriggerFile(fileInput.files[0])
    fileInput.value = ''
  })

  async function loadTriggerFile(file: File) {
    try {
      const { dimensions } = await triggerUploader.handleFile(file)
      const maxDim = Math.max(dimensions.width, dimensions.height)
      triggerWidth  = (dimensions.width  / maxDim) * 150
      triggerHeight = (dimensions.height / maxDim) * 150

      const url = await triggerUploader.getTriggerDataURL() as string
      thumb.src = url
      nameEl.textContent = file.name
      zone.style.display   = 'none'
      loaded.classList.add('show')

      preview3D.setTriggerImage(url, triggerWidth, triggerHeight)

      // Refresh all existing layers in preview
      layerManager.getAllLayers().forEach(l => preview3D.updateLayer(l, triggerWidth))
    } catch (err) {
      alert(`Error cargando trigger: ${err instanceof Error ? err.message : err}`)
    }
  }
}

// ── Layers UI ───────────────────────────────────────────────────────────────

function renderLayersList(layers: Layer[], activeId: string | null) {
  const container = document.getElementById('layersList') as HTMLElement
  const empty     = document.getElementById('layersEmpty') as HTMLElement
  const title     = document.getElementById('layersTitle') as HTMLElement

  title.textContent = `Capas (${layers.length})`

  if (layers.length === 0) {
    empty.style.display = 'block'
    container.innerHTML = ''
    return
  }
  empty.style.display = 'none'

  container.innerHTML = layers.map((layer, i) => {
    const icon  = TYPE_ICONS[layer.type] || '?'
    const label = layer.type === 'texto'
      ? (layer.texto || 'Texto AR')
      : (layer.file ? layer.file.name : 'Sin archivo')
    const isEmpty = layer.type !== 'texto' && !layer.file

    return `
    <div class="layer-item ${layer.id === activeId ? 'active' : ''}" data-id="${layer.id}">
      <div class="layer-num">${i + 1}</div>
      <div class="layer-type-icon">${icon}</div>
      <div class="layer-label ${isEmpty ? 'empty' : ''}">${label}</div>
      <button class="layer-del" data-del="${layer.id}" title="Eliminar">✕</button>
    </div>`
  }).join('')

  container.querySelectorAll('.layer-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id')
      if (id) layerManager.selectLayer(id)
    })
  })

  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.getAttribute('data-del')
      if (id) {
        preview3D.removeLayer(id)
        layerManager.deleteLayer(id)
      }
    })
  })
}

// ── Props panel ─────────────────────────────────────────────────────────────

function updatePropsPanel(layer: Layer | undefined) {
  const panel       = document.getElementById('layerPropsPanel') as HTMLElement
  const fileGroup   = document.getElementById('propFileGroup') as HTMLElement
  const fileDrop    = document.getElementById('propFileDrop') as HTMLElement
  const fileLoaded  = document.getElementById('propFileLoaded') as HTMLElement
  const fileIcon    = document.getElementById('propFileIcon') as HTMLElement
  const fileName    = document.getElementById('propFileName') as HTMLElement
  const textoGroup  = document.getElementById('propTextoGroup') as HTMLElement
  const propTitle   = document.getElementById('propTitle') as HTMLElement

  if (!layer) {
    panel.style.display = 'none'
    return
  }

  panel.style.display = 'block'
  propTitle.textContent = `${TYPE_ICONS[layer.type]} ${layer.type.toUpperCase()}`

  const isTexto = layer.type === 'texto'
  fileGroup.style.display  = isTexto ? 'none' : 'block'
  textoGroup.style.display = isTexto ? 'block' : 'none'

  if (!isTexto) {
    if (layer.file) {
      fileDrop.style.display   = 'none'
      fileLoaded.style.display = 'flex'
      fileIcon.textContent     = TYPE_ICONS[layer.type]
      fileName.textContent     = layer.file.name
    } else {
      fileDrop.style.display   = 'block'
      fileLoaded.style.display = 'none'
    }
  }

  if (isTexto) {
    const ta = document.getElementById('propTexto') as HTMLTextAreaElement
    ta.value = layer.texto || ''
  }

  // Sliders
  const set = (id: string, val: number) => {
    const el = document.getElementById(id) as HTMLInputElement
    if (el) el.value = val.toString()
  }
  set('propScale',   layer.scale)
  set('propOpacity', layer.opacity * 100)
  set('propPosX',    layer.posX)
  set('propPosY',    layer.posY)
  set('propPosZ',    layer.posZ)

  updateSliderValues(layer)
}

function updateSliderValues(layer: Layer) {
  const v = (id: string, text: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }
  v('valScale',   `${layer.scale.toFixed(1)}×`)
  v('valOpacity', `${Math.round(layer.opacity * 100)}%`)
  v('valPosX',    layer.posX.toFixed(2))
  v('valPosY',    layer.posY.toFixed(2))
  v('valPosZ',    layer.posZ.toString())
}

// ── Layer file upload ────────────────────────────────────────────────────────

function setupLayerFileInput() {
  const fileInput = document.getElementById('layerFileInput') as HTMLInputElement
  const fileDrop  = document.getElementById('propFileDrop') as HTMLElement
  const btnChange = document.getElementById('btnChangeFile') as HTMLElement

  const openPicker = () => {
    const active = layerManager.getActiveLayer()
    if (!active) return
    fileInput.accept = TYPE_ACCEPT[active.type] || ''
    fileInput.click()
  }

  fileDrop.addEventListener('click', openPicker)
  btnChange.addEventListener('click', openPicker)

  // Drag & drop support
  fileDrop.addEventListener('dragover', e => {
    e.preventDefault()
    fileDrop.style.borderColor = 'var(--accent)'
    fileDrop.style.background  = 'rgba(230,51,41,0.08)'
  })
  fileDrop.addEventListener('dragleave', () => {
    fileDrop.style.borderColor = ''
    fileDrop.style.background  = ''
  })
  fileDrop.addEventListener('drop', e => {
    e.preventDefault()
    fileDrop.style.borderColor = ''
    fileDrop.style.background  = ''
    const file = e.dataTransfer?.files[0]
    if (file) applyLayerFile(file)
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) applyLayerFile(file)
    fileInput.value = ''
  })

  function applyLayerFile(file: File) {
    const active = layerManager.getActiveLayer()
    if (!active) return
    layerManager.updateLayer(active.id, { file })
    // updateLayer triggers subscriber → updatePropsPanel + preview3D.updateLayer
  }
}

// ── Sliders ──────────────────────────────────────────────────────────────────

function setupSliders() {
  const slider = (id: string, onChange: (val: number) => Partial<Layer>, display: (val: number) => string, dispId: string) => {
    const el = document.getElementById(id) as HTMLInputElement
    if (!el) return
    el.addEventListener('input', () => {
      const val    = parseFloat(el.value)
      const active = layerManager.getActiveLayer()
      if (!active) return
      const disp = document.getElementById(dispId)
      if (disp) disp.textContent = display(val)
      layerManager.updateLayer(active.id, onChange(val))
      // subscriber handles preview update
    })
  }

  slider('propScale',   v => ({ scale: v }),         v => `${v.toFixed(1)}×`,  'valScale')
  slider('propOpacity', v => ({ opacity: v / 100 }), v => `${Math.round(v)}%`, 'valOpacity')
  slider('propPosX',    v => ({ posX: v }),           v => v.toFixed(2),        'valPosX')
  slider('propPosY',    v => ({ posY: v }),           v => v.toFixed(2),        'valPosY')
  slider('propPosZ',    v => ({ posZ: v }),           v => v.toString(),        'valPosZ')

  const textarea = document.getElementById('propTexto') as HTMLTextAreaElement
  if (textarea) {
    textarea.addEventListener('input', () => {
      const active = layerManager.getActiveLayer()
      if (active) layerManager.updateLayer(active.id, { texto: textarea.value })
    })
  }
}

// ── Publish ──────────────────────────────────────────────────────────────────

function setupPublish() {
  const btn     = document.getElementById('btnPublish') as HTMLButtonElement
  const overlay = document.getElementById('publishOverlay') as HTMLElement
  const fill    = document.getElementById('pubFill') as HTMLElement
  const msg     = document.getElementById('pubMsg') as HTMLElement
  const result  = document.getElementById('pubResult') as HTMLElement
  const btnClose = document.getElementById('btnClosePub') as HTMLElement

  btnClose.addEventListener('click', () => {
    overlay.classList.remove('show')
    btn.disabled = false
  })

  btn.addEventListener('click', async () => {
    const nombre = (document.getElementById('inputNombre') as HTMLInputElement).value.trim()
    if (!nombre) { alert('Ingresa un nombre para el proyecto'); return }
    if (!triggerUploader.getTriggerFile()) { alert('Selecciona una imagen trigger'); return }
    const layers = layerManager.getAllLayers()
    const validLayers = layers.filter(l => l.file || l.type === 'texto')
    if (validLayers.length === 0) { alert('Agrega al menos una capa con archivo o texto'); return }

    btn.disabled = true
    overlay.classList.add('show')
    fill.style.width = '0%'
    msg.textContent = 'Iniciando...'
    result.innerHTML = ''
    btnClose.style.display = 'none'

    const anchoReal = parseFloat((document.getElementById('inputWidth') as HTMLInputElement).value) || 21
    const altoReal  = parseFloat((document.getElementById('inputHeight') as HTMLInputElement).value) || 29.7

    try {
      await publisher.publishProject({
        nombre,
        slug: nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        trigger: triggerUploader.getTriggerFile()!,
        triggerW: triggerWidth,
        triggerH: triggerHeight,
        layers,
        anchoReal,
        altoReal
      }, nombre, (event: PublishEvent) => {
        if (event.type === 'progress') {
          fill.style.width = `${event.percent}%`
          msg.textContent = event.message
        } else if (event.type === 'success') {
          fill.style.width = '100%'
          msg.textContent = '¡Listo!'
          result.innerHTML = `<a href="${event.url}" target="_blank">${event.url}</a>`
          btnClose.style.display = 'block'
        } else {
          msg.textContent = `Error: ${event.message}`
          btnClose.style.display = 'block'
          btn.disabled = false
        }
      })
    } catch {
      btnClose.style.display = 'block'
      btn.disabled = false
    }
  })
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 3D canvas
  const canvasEl = document.getElementById('canvas3d') as HTMLElement
  if (canvasEl) {
    preview3D.init(canvasEl)

    // When a layer is dragged in the 3D view, sync back to sliders + layer manager
    preview3D.onLayerMoved = (id, posX, posY) => {
      layerManager.updateLayer(id, { posX, posY })
      // Sync slider values if this is the active layer
      const active = layerManager.getActiveLayer()
      if (active?.id === id) {
        const sliderX = document.getElementById('propPosX') as HTMLInputElement
        const sliderY = document.getElementById('propPosY') as HTMLInputElement
        const valX    = document.getElementById('valPosX')
        const valY    = document.getElementById('valPosY')
        if (sliderX) sliderX.value = posX.toFixed(2)
        if (sliderY) sliderY.value = posY.toFixed(2)
        if (valX) valX.textContent = posX.toFixed(2)
        if (valY) valY.textContent = posY.toFixed(2)
      }
    }
  }

  // Trigger
  setupTriggerUpload()

  // Layer type add buttons
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type') as Layer['type']
      if (!type) return
      if (layerManager.getAllLayers().length >= 20) { alert('Máximo 20 capas'); return }
      const layer = layerManager.addLayer(type)
      preview3D.addLayer(layer, triggerWidth)
    })
  })

  // Layer manager subscription → render list + update props + sync preview
  layerManager.subscribe((layers, activeId) => {
    renderLayersList(layers, activeId)
    const active = activeId ? layerManager.getLayer(activeId) : undefined
    updatePropsPanel(active)
    // Sync all layers to preview (handles file changes, property changes)
    layers.forEach(l => preview3D.updateLayer(l, triggerWidth))
  })

  // Layer file input
  setupLayerFileInput()

  // Sliders
  setupSliders()

  // Publish
  setupPublish()
})
