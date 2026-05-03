import { TriggerUploader } from './TriggerUploader'
import { LayerManager } from './LayerManager'
import { Preview3D } from './Preview3D'
import { Publisher, PublishEvent } from './Publisher'
import { deleteProject } from '@/utils/WorkerClient'
import { Layer } from '@/types'

interface SavedProject { slug: string; nombre: string; url: string; publishedAt: string }

function trackProject(slug: string, nombre: string, url: string) {
  const key = 'ara_projects'
  const list: SavedProject[] = JSON.parse(localStorage.getItem(key) || '[]')
  const existing = list.findIndex(p => p.slug === slug)
  const entry = { slug, nombre, url, publishedAt: new Date().toISOString() }
  if (existing >= 0) list[existing] = entry; else list.unshift(entry)
  localStorage.setItem(key, JSON.stringify(list))
}

function loadProjects(): SavedProject[] {
  return JSON.parse(localStorage.getItem('ara_projects') || '[]')
}

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
    const colorEl = document.getElementById('propColorTexto') as HTMLInputElement
    if (colorEl) colorEl.value = layer.colorTexto || '#ffffff'
    const tamEl = document.getElementById('propTamanoTexto') as HTMLInputElement
    if (tamEl) tamEl.value = (layer.tamanoTexto ?? 0.5).toString()
    const extEl = document.getElementById('propExtrusionTexto') as HTMLInputElement
    if (extEl) extEl.value = (layer.extrusionDepth ?? 0).toString()
    const fontEl = document.getElementById('propFontTexto') as HTMLSelectElement
    if (fontEl) fontEl.value = layer.fontTexto || 'roboto'
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

  // Animation buttons + params
  const activeAnim = layer.animation || ''
  document.querySelectorAll('#animButtons .anim-btn').forEach(btn => {
    const anim = btn.getAttribute('data-anim') || ''
    btn.classList.toggle('active', anim === activeAnim)
    btn.classList.toggle('full', anim === '' && !activeAnim)
  })
  const animParams = document.getElementById('animParams') as HTMLElement
  if (animParams) animParams.style.display = activeAnim ? 'block' : 'none'
  const ampRow = document.getElementById('animAmplitudeRow') as HTMLElement
  const ampLabel = document.getElementById('animAmplitudeLabel') as HTMLElement
  if (ampRow) {
    const showAmp = activeAnim === 'float' || activeAnim === 'rotate'
    ampRow.style.display = showAmp ? 'flex' : 'none'
    if (ampLabel) ampLabel.textContent = activeAnim === 'rotate' ? 'Velocidad (ms/vuelta)' : 'Amplitud'
  }
  const set2 = (id: string, val: number) => { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = val.toString() }
  set2('propAnimDuration', layer.animationDuration ?? (activeAnim === 'fade' ? 800 : activeAnim === 'scale' ? 600 : activeAnim === 'rotate' ? 6000 : 2000))
  set2('propAnimDelay', layer.animationDelay ?? 0)
  set2('propAnimAmplitude', layer.animationAmplitude ?? (activeAnim === 'rotate' ? 6000 : 0.04))

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
  if (layer.type === 'texto') {
    v('valTamanoTexto',   `${(layer.tamanoTexto ?? 0.5).toFixed(2)}×`)
    v('valExtrusionTexto', (layer.extrusionDepth ?? 0).toFixed(2))
  }
  const a = layer.animation || ''
  v('valAnimDuration', `${layer.animationDuration ?? (a === 'fade' ? 800 : a === 'scale' ? 600 : a === 'rotate' ? 6000 : 2000)}ms`)
  v('valAnimDelay',    `${layer.animationDelay ?? 0}ms`)
  v('valAnimAmplitude', (layer.animationAmplitude ?? (a === 'rotate' ? 6000 : 0.04)).toString())
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

  async function applyLayerFile(file: File) {
    const active = layerManager.getActiveLayer()
    if (!active) return
    const dims = await detectFileDimensions(file)
    layerManager.updateLayer(active.id, { file, naturalWidth: dims.w, naturalHeight: dims.h })
  }

  function detectFileDimensions(file: File): Promise<{ w: number; h: number }> {
    return new Promise(resolve => {
      if (file.type.startsWith('image/')) {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload  = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }) }
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 1, h: 1 }) }
        img.src = url
      } else if (file.type.startsWith('video/')) {
        const vid = document.createElement('video')
        const url = URL.createObjectURL(file)
        vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ w: vid.videoWidth, h: vid.videoHeight }) }
        vid.onerror          = () => { URL.revokeObjectURL(url); resolve({ w: 1, h: 1 }) }
        vid.src = url
      } else {
        resolve({ w: 1, h: 1 })
      }
    })
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

  slider('propTamanoTexto', v => ({ tamanoTexto: v }), v => `${v.toFixed(2)}×`, 'valTamanoTexto')
  slider('propExtrusionTexto', v => ({ extrusionDepth: v }), v => v.toFixed(3), 'valExtrusionTexto')

  const textarea = document.getElementById('propTexto') as HTMLTextAreaElement
  if (textarea) {
    textarea.addEventListener('input', () => {
      const active = layerManager.getActiveLayer()
      if (active) layerManager.updateLayer(active.id, { texto: textarea.value })
    })
  }

  const colorPicker = document.getElementById('propColorTexto') as HTMLInputElement
  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      const active = layerManager.getActiveLayer()
      if (active) layerManager.updateLayer(active.id, { colorTexto: colorPicker.value })
    })
  }

  const fontSel = document.getElementById('propFontTexto') as HTMLSelectElement
  if (fontSel) {
    fontSel.addEventListener('change', () => {
      const active = layerManager.getActiveLayer()
      if (active) layerManager.updateLayer(active.id, { fontTexto: fontSel.value })
    })
  }

  // Animation parameter sliders
  const animSlider = (id: string, field: keyof Layer, dispId: string, fmt: (v: number) => string) => {
    const el = document.getElementById(id) as HTMLInputElement
    if (!el) return
    el.addEventListener('input', () => {
      const val = parseFloat(el.value)
      const active = layerManager.getActiveLayer()
      if (!active) return
      const disp = document.getElementById(dispId)
      if (disp) disp.textContent = fmt(val)
      layerManager.updateLayer(active.id, { [field]: val } as Partial<Layer>)
    })
  }
  animSlider('propAnimDuration',  'animationDuration',  'valAnimDuration',  v => `${v}ms`)
  animSlider('propAnimDelay',     'animationDelay',     'valAnimDelay',     v => `${v}ms`)
  animSlider('propAnimAmplitude', 'animationAmplitude', 'valAnimAmplitude', v => v.toString())
}

// ── Publish ──────────────────────────────────────────────────────────────────

async function shortenUrl(url: string): Promise<string> {
  try {
    const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`)
    const data = await res.json()
    return data.shorturl || url
  } catch {
    return url
  }
}

function setupPublish() {
  const btn      = document.getElementById('btnPublish') as HTMLButtonElement
  const overlay  = document.getElementById('publishOverlay') as HTMLElement
  const fill     = document.getElementById('pubFill') as HTMLElement
  const msg      = document.getElementById('pubMsg') as HTMLElement
  const result   = document.getElementById('pubResult') as HTMLElement
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
      }, nombre, async (event: PublishEvent) => {
        if (event.type === 'progress') {
          fill.style.width = `${event.percent}%`
          msg.textContent = event.message
        } else if (event.type === 'success') {
          fill.style.width = '100%'
          msg.textContent = 'Acortando enlace...'

          const shortUrl = await shortenUrl(event.url)
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=f0f0f0&bgcolor=111111&data=${encodeURIComponent(shortUrl)}`

          msg.textContent = '¡Publicado!'
          result.innerHTML = `
            <div style="margin:12px 0 8px;">
              <img src="${qrSrc}" alt="QR" style="border-radius:8px;display:block;margin:0 auto 10px;" width="180" height="180">
            </div>
            <a href="${shortUrl}" target="_blank" style="font-size:13px;font-weight:700;">${shortUrl}</a>
            <div style="font-size:9px;color:#555;margin-top:4px;word-break:break-all;">${event.url}</div>
          `
          const slug2 = nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
          trackProject(slug2, nombre, shortUrl)
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

// ── Animation buttons ────────────────────────────────────────────────────────

function setupAnimationButtons() {
  document.querySelectorAll('#animButtons .anim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const animVal = btn.getAttribute('data-anim') || ''
      const anim = animVal as Layer['animation']
      const active = layerManager.getActiveLayer()
      if (!active) return
      // Set default duration for each animation type
      const defDur = animVal === 'fade' ? 800 : animVal === 'scale' ? 600 : animVal === 'rotate' ? 6000 : 2000
      layerManager.updateLayer(active.id, {
        animation: anim || undefined,
        animationDuration: active.animationDuration ?? defDur
      })
    })
  })
}

// ── Projects panel ───────────────────────────────────────────────────────────

function setupProjects() {
  const overlay   = document.getElementById('projectsOverlay') as HTMLElement
  const list      = document.getElementById('projectsList') as HTMLElement
  const btnOpen   = document.getElementById('btnProjects') as HTMLElement
  const btnClose  = document.getElementById('btnCloseProjects') as HTMLElement

  const render = () => {
    const projects = loadProjects()
    if (projects.length === 0) {
      list.innerHTML = '<div class="projects-empty">No hay proyectos publicados todavía.</div>'
      return
    }
    list.innerHTML = projects.map(p => `
      <div class="project-item" data-slug="${p.slug}">
        <div>
          <div class="project-item-name">${p.nombre}</div>
          <div class="project-item-date">${new Date(p.publishedAt).toLocaleDateString()}</div>
        </div>
        <a href="${p.url}" target="_blank" class="btn-sm" style="text-decoration:none;">Ver</a>
        <button class="btn-del-project" data-slug="${p.slug}">Borrar</button>
      </div>`).join('')

    list.querySelectorAll('.btn-del-project').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug')!
        if (!confirm(`¿Borrar "${slug}"? El link dejará de funcionar.`)) return
        btn.textContent = 'Borrando...'
        ;(btn as HTMLButtonElement).disabled = true
        try {
          await deleteProject(slug)
          const stored: SavedProject[] = JSON.parse(localStorage.getItem('ara_projects') || '[]')
          localStorage.setItem('ara_projects', JSON.stringify(stored.filter(p => p.slug !== slug)))
          render()
        } catch {
          alert('Error al borrar el proyecto')
          ;(btn as HTMLButtonElement).disabled = false
          btn.textContent = 'Borrar'
        }
      })
    })
  }

  btnOpen.addEventListener('click', () => { render(); overlay.classList.add('show') })
  btnClose.addEventListener('click', () => overlay.classList.remove('show'))
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show') })
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

  // Animation buttons
  setupAnimationButtons()

  // Publish
  setupPublish()

  // Projects
  setupProjects()
})
