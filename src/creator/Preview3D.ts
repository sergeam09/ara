import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { Layer } from '@/types'

interface LayerEntry {
  mesh: THREE.Mesh
  objectURL?: string
  videoEl?: HTMLVideoElement
  layer: Layer
  baseElevation: number
}

const FONT_MAP: Record<string, string> = {
  roboto:          'Roboto, Arial, sans-serif',
  ubuntu:          'Ubuntu, "Segoe UI", Tahoma, sans-serif',
  dejavu:          '"DejaVu Sans", Verdana, Geneva, sans-serif',
  exo2bold:        '"Exo 2", Impact, "Arial Black", sans-serif',
  exo2semibold:    '"Exo 2", "Trebuchet MS", sans-serif',
  kelsonsans:      'Tahoma, Geneva, sans-serif',
  sourcecodepro:   '"Source Code Pro", "Courier New", Courier, monospace',
  aileronsemibold: '"Gill Sans", Optima, Helvetica, Arial, sans-serif',
}

const DEG = THREE.MathUtils.degToRad
const RAD = THREE.MathUtils.radToDeg

export class Preview3D {
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private controls: OrbitControls | null = null
  private transformControls: TransformControls | null = null
  private boxHelper: THREE.BoxHelper | null = null
  private triggerMesh: THREE.Mesh | null = null
  private layers: Map<string, LayerEntry> = new Map()
  private container: HTMLElement | null = null
  private animId = 0
  private triggerW = 150
  private triggerH = 100
  private clock = new THREE.Clock()

  // Drag state (free XZ drag)
  private dragging = false
  private dragLayerId: string | null = null
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private dragOffset = new THREE.Vector3()
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()

  // TC state
  private tcDragging = false
  private tcMode: 'translate' | 'rotate' = 'translate'

  // UI overlays
  private coordTip: HTMLDivElement | null = null
  private dimLabel: HTMLDivElement | null = null

  // Fired on drag/TC end with layer property updates
  onLayerTransformed: ((id: string, update: Partial<Layer>) => void) | null = null
  // Fired when a layer mesh is clicked in the viewport
  onLayerSelected: ((id: string) => void) | null = null

  init(container: HTMLElement): void {
    this.container = container
    container.style.position = 'relative'

    // ── Overlays ────────────────────────────────────────────────────────────
    const tip = document.createElement('div')
    tip.style.cssText = 'position:absolute;background:rgba(0,0,0,0.85);color:#e63329;font-size:10px;font-weight:700;font-family:monospace;padding:4px 9px;border-radius:4px;pointer-events:none;display:none;z-index:20;white-space:nowrap;border:1px solid rgba(230,51,41,0.4);'
    container.appendChild(tip)
    this.coordTip = tip

    const dim = document.createElement('div')
    dim.style.cssText = 'position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.7);color:#aaa;font-size:10px;font-family:monospace;padding:3px 8px;border-radius:4px;pointer-events:none;display:none;z-index:20;'
    container.appendChild(dim)
    this.dimLabel = dim

    // ── TC mode toggle buttons ───────────────────────────────────────────────
    const modeBar = document.createElement('div')
    modeBar.style.cssText = 'position:absolute;top:10px;right:10px;z-index:25;display:flex;gap:6px;'
    modeBar.innerHTML = `
      <button id="tc-btn-translate" title="Mover [W]" style="background:#1a1a1a;border:2px solid #e63329;color:#e63329;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:0.04em;font-family:monospace;">↔ MOVER</button>
      <button id="tc-btn-rotate"    title="Rotar [E]" style="background:#1a1a1a;border:2px solid #444;color:#666;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:0.04em;font-family:monospace;">↻ ROTAR</button>
    `
    container.appendChild(modeBar)
    modeBar.querySelector('#tc-btn-translate')?.addEventListener('click', () => this.setTransformMode('translate'))
    modeBar.querySelector('#tc-btn-rotate')?.addEventListener('click',    () => this.setTransformMode('rotate'))
    // Keyboard shortcuts W / E
    document.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return
      if (ev.key === 'w' || ev.key === 'W') this.setTransformMode('translate')
      if (ev.key === 'e' || ev.key === 'E') this.setTransformMode('rotate')
    })

    // ── Scene ────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)

    const w = container.clientWidth || 800
    const h = container.clientHeight || 600
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000)
    this.camera.position.set(0, 220, 280)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    // ── Orbit controls ────────────────────────────────────────────────────────
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 50
    this.controls.maxDistance = 1200
    this.controls.target.set(0, 0, 0)

    // ── TransformControls ─────────────────────────────────────────────────────
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement)
    this.transformControls.setSize(0.75)
    this.scene.add(this.transformControls as unknown as THREE.Object3D)

    this.transformControls.addEventListener('dragging-changed', (event: any) => {
      this.tcDragging = event.value
      if (this.controls) this.controls.enabled = !event.value
      if (!event.value) {
        // Drag ended — fire final positions to layer manager
        const obj = this.transformControls?.object as THREE.Mesh | undefined
        if (obj) this.fireTCCallback(obj)
        if (this.coordTip) this.coordTip.style.display = 'none'
      }
    })

    this.transformControls.addEventListener('objectChange', () => {
      // During drag: update tooltip only — do NOT call onLayerTransformed
      // (calling it would trigger updateLayer, which rebuilds the mesh, killing the drag)
      const obj = this.transformControls?.object as THREE.Mesh | undefined
      if (obj && this.tcDragging) this.updateTCTip(obj)
    })

    // ── Lights ────────────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dir = new THREE.DirectionalLight(0xffffff, 0.5)
    dir.position.set(100, 300, 150)
    this.scene.add(dir)

    // ── Grid ──────────────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(600, 60, 0x2a2a2a, 0x1a1a1a)
    grid.position.y = -1
    this.scene.add(grid)

    // ── Mouse events ──────────────────────────────────────────────────────────
    const canvas = this.renderer.domElement
    canvas.addEventListener('mousedown',  this.onMouseDown)
    canvas.addEventListener('mousemove',  this.onMouseMove)
    canvas.addEventListener('mouseup',    this.onMouseUp)
    canvas.addEventListener('mouseleave', this.onMouseUp)

    window.addEventListener('resize', this.onResize)
    this.clock.start()
    this.animate()
  }

  setTransformMode(mode: 'translate' | 'rotate'): void {
    this.tcMode = mode
    this.transformControls?.setMode(mode)
    // Update button styles
    const btnT = this.container?.querySelector('#tc-btn-translate') as HTMLButtonElement
    const btnR = this.container?.querySelector('#tc-btn-rotate')    as HTMLButtonElement
    if (btnT) { btnT.style.borderColor = mode === 'translate' ? '#e63329' : '#444'; btnT.style.color = mode === 'translate' ? '#e63329' : '#888' }
    if (btnR) { btnR.style.borderColor = mode === 'rotate'    ? '#e63329' : '#444'; btnR.style.color = mode === 'rotate'    ? '#e63329' : '#888' }
  }

  selectLayer(id: string | null): void {
    if (!this.transformControls || !this.scene) return
    // Remove old box helper
    if (this.boxHelper) { this.scene.remove(this.boxHelper); this.boxHelper = null }
    if (this.dimLabel) this.dimLabel.style.display = 'none'

    if (!id) { this.transformControls.detach(); return }

    const entry = this.layers.get(id)
    if (!entry) { this.transformControls.detach(); return }

    this.transformControls.attach(entry.mesh)

    // Box helper — red wireframe around selected layer
    this.boxHelper = new THREE.BoxHelper(entry.mesh, 0xe63329)
    this.scene.add(this.boxHelper)

    // Dimension annotation
    this.showDimLabel(entry.mesh, entry.layer)
  }

  private showDimLabel(mesh: THREE.Mesh, layer: Layer): void {
    if (!this.dimLabel) return
    const bbox = new THREE.Box3().setFromObject(mesh)
    const size = bbox.getSize(new THREE.Vector3())
    const halfW = this.triggerW / 2
    const wx = (size.x / halfW).toFixed(2)
    const wz = (size.z / halfW).toFixed(2)
    const typeLabel = layer.type === 'texto' ? 'Texto' : layer.type.toUpperCase()
    this.dimLabel.textContent = `${typeLabel}  ${wx} × ${wz} u  |  escala ${layer.scale.toFixed(2)}×  |  Z ${layer.posZ}`
    this.dimLabel.style.display = 'block'
  }

  // ── Layer CRUD ────────────────────────────────────────────────────────────

  addLayer(layer: Layer, triggerWidth: number): void {
    this.updateLayer(layer, triggerWidth)
  }

  updateLayer(layer: Layer, triggerWidth: number): void {
    if (!this.scene) return

    const wasSelected = (this.transformControls as any)?.object?.userData?.layerId === layer.id
    if (wasSelected) this.transformControls?.detach()

    this.removeLayer(layer.id)

    const aspect = (layer.naturalWidth && layer.naturalHeight)
      ? layer.naturalWidth / layer.naturalHeight
      : layer.type === 'texto' ? 4 : 1

    // For texto, tamanoTexto controls the plane size (matches viewer formula: fw = max(0.5, size*2))
    const textoScale = layer.type === 'texto'
      ? Math.max(0.25, (layer.tamanoTexto ?? 0.5) * 2)
      : 1
    const w = triggerWidth * layer.scale * textoScale
    const h = w / aspect
    const geo = new THREE.PlaneGeometry(w, h)
    geo.rotateX(-Math.PI / 2)

    let mat: THREE.MeshLambertMaterial
    let objectURL: string | undefined
    let videoEl: HTMLVideoElement | undefined

    if (layer.file && layer.file.type.startsWith('video/')) {
      objectURL = URL.createObjectURL(layer.file)
      videoEl = document.createElement('video')
      videoEl.src = objectURL; videoEl.muted = true; videoEl.loop = true
      videoEl.playsInline = true; videoEl.crossOrigin = 'anonymous'
      videoEl.play().catch(() => {})
      mat = new THREE.MeshLambertMaterial({ map: new THREE.VideoTexture(videoEl), transparent: true, opacity: layer.opacity, side: THREE.DoubleSide, depthWrite: false })
    } else if (layer.file && layer.file.type.startsWith('image/')) {
      objectURL = URL.createObjectURL(layer.file)
      mat = new THREE.MeshLambertMaterial({ map: new THREE.TextureLoader().load(objectURL), transparent: true, opacity: layer.opacity, side: THREE.DoubleSide, depthWrite: false })
    } else if (layer.type === 'texto') {
      mat = new THREE.MeshLambertMaterial({ map: this.makeTextTexture(layer.texto || 'Texto AR', layer.colorTexto || '#ffffff', layer.fontTexto || 'roboto', layer.extrusionDepth ?? 0), transparent: true, opacity: layer.opacity, side: THREE.DoubleSide, depthWrite: false })
    } else {
      mat = new THREE.MeshLambertMaterial({ color: this.typeColor(layer.type), transparent: true, opacity: layer.file ? 0.45 : 0.3, side: THREE.DoubleSide, wireframe: !layer.file })
    }

    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData = { layerId: layer.id, isLayer: true }

    const baseElevation = this.calcElevation(layer)
    mesh.position.set(layer.posX * (this.triggerW / 2), baseElevation, layer.posY * (this.triggerW / 2))
    mesh.rotation.set(DEG(layer.rotX ?? 0), DEG(layer.rotY ?? 0), DEG(layer.rotZ ?? 0))

    this.scene.add(mesh)
    this.layers.set(layer.id, { mesh, objectURL, videoEl, layer: { ...layer }, baseElevation })

    if (wasSelected) {
      this.transformControls?.attach(mesh)
      // Refresh box helper
      if (this.boxHelper) { this.scene.remove(this.boxHelper) }
      this.boxHelper = new THREE.BoxHelper(mesh, 0xe63329)
      this.scene.add(this.boxHelper)
      this.showDimLabel(mesh, layer)
    }

    this.playEntranceAnimation(mesh, layer)
  }

  removeLayer(id: string): void {
    const entry = this.layers.get(id)
    if (!entry || !this.scene) return
    if ((this.transformControls as any)?.object === entry.mesh) {
      this.transformControls?.detach()
      if (this.boxHelper) { this.scene.remove(this.boxHelper); this.boxHelper = null }
    }
    this.scene.remove(entry.mesh)
    ;(entry.mesh.material as THREE.MeshLambertMaterial).map?.dispose()
    ;(entry.mesh.material as THREE.MeshLambertMaterial).dispose()
    entry.mesh.geometry.dispose()
    if (entry.videoEl) { entry.videoEl.pause(); entry.videoEl.src = '' }
    if (entry.objectURL) URL.revokeObjectURL(entry.objectURL)
    this.layers.delete(id)
  }

  setTriggerImage(dataURL: string, width: number, height: number): void {
    if (!this.scene) return
    this.triggerW = width; this.triggerH = height
    if (this.triggerMesh) {
      this.scene.remove(this.triggerMesh)
      ;(this.triggerMesh.material as THREE.MeshLambertMaterial).map?.dispose()
      ;(this.triggerMesh.material as THREE.MeshLambertMaterial).dispose()
      this.triggerMesh.geometry.dispose()
    }
    const geo = new THREE.PlaneGeometry(width, height)
    geo.rotateX(-Math.PI / 2)
    this.triggerMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: new THREE.TextureLoader().load(dataURL), transparent: true, opacity: 0.92, side: THREE.DoubleSide }))
    this.triggerMesh.userData = { isTrigger: true }
    this.scene.add(this.triggerMesh)
  }

  // ── TC callback ──────────────────────────────────────────────────────────

  private fireTCCallback(mesh: THREE.Mesh): void {
    const id = mesh.userData.layerId as string
    if (!id) return
    const halfW = this.triggerW / 2
    if (this.tcMode === 'translate') {
      const posX = mesh.position.x / halfW
      const posY = mesh.position.z / halfW
      const posZ = Math.round(Math.max(0, Math.min(200, (mesh.position.y - 1) * 8)))
      // Update stored base elevation
      const entry = this.layers.get(id)
      if (entry) entry.baseElevation = mesh.position.y
      this.onLayerTransformed?.(id, { posX, posY, posZ })
    } else {
      const rotX = Math.round(RAD(mesh.rotation.x))
      const rotY = Math.round(RAD(mesh.rotation.y))
      const rotZ = Math.round(RAD(mesh.rotation.z))
      this.onLayerTransformed?.(id, { rotX, rotY, rotZ })
    }
  }

  private updateTCTip(mesh: THREE.Mesh): void {
    if (!this.coordTip) return
    const halfW = this.triggerW / 2
    let text: string
    if (this.tcMode === 'translate') {
      const posX = mesh.position.x / halfW
      const posY = mesh.position.z / halfW
      const posZ = Math.round(Math.max(0, Math.min(200, (mesh.position.y - 1) * 8)))
      text = `X ${posX >= 0 ? '+' : ''}${posX.toFixed(2)}  Y ${posY >= 0 ? '+' : ''}${posY.toFixed(2)}  Z ${posZ}`
    } else {
      text = `RX ${Math.round(RAD(mesh.rotation.x))}°  RY ${Math.round(RAD(mesh.rotation.y))}°  RZ ${Math.round(RAD(mesh.rotation.z))}°`
    }
    this.coordTip.style.left = '8px'
    this.coordTip.style.top  = '8px'
    this.coordTip.style.display = 'block'
    this.coordTip.textContent = text
  }

  // ── Free drag (XZ plane) ──────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.camera || !this.renderer || this.tcDragging) return
    this.setMouse(e)
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Check TC gizmo objects first — if TC is handling the event, skip
    const tcChildren: THREE.Object3D[] = []
    this.transformControls?.traverse(o => { if (o !== this.transformControls) tcChildren.push(o) })
    if (this.raycaster.intersectObjects(tcChildren, false).length > 0) return

    const layerMeshes = Array.from(this.layers.values()).map(en => en.mesh)
    const hits = this.raycaster.intersectObjects(layerMeshes, false)
    if (hits.length > 0) {
      const hit = hits[0]
      const id = hit.object.userData.layerId as string
      if (!id) return

      // Click to select
      this.onLayerSelected?.(id)

      // Start free drag only in translate mode
      if (this.tcMode !== 'translate') return

      this.dragging = true
      this.dragLayerId = id
      if (this.controls) this.controls.enabled = false
      this.dragPlane.set(new THREE.Vector3(0, 1, 0), -hit.object.position.y)
      const pt = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this.dragPlane, pt)
      this.dragOffset.copy(pt).sub(hit.object.position)
      e.stopPropagation()
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging || !this.dragLayerId || !this.camera) return
    this.setMouse(e)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const pt = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(this.dragPlane, pt)
    const entry = this.layers.get(this.dragLayerId)
    if (!entry) return
    const newPos = pt.clone().sub(this.dragOffset)
    entry.mesh.position.x = newPos.x
    entry.mesh.position.z = newPos.z
    if (this.boxHelper) this.boxHelper.update()

    const halfW = this.triggerW / 2
    const posX = newPos.x / halfW
    const posY = newPos.z / halfW
    if (this.coordTip && this.renderer) {
      const rect = this.renderer.domElement.getBoundingClientRect()
      this.coordTip.style.left = `${e.clientX - rect.left + 14}px`
      this.coordTip.style.top  = `${e.clientY - rect.top  - 28}px`
      this.coordTip.style.display = 'block'
      this.coordTip.textContent = `X ${posX >= 0 ? '+' : ''}${posX.toFixed(2)}  Y ${posY >= 0 ? '+' : ''}${posY.toFixed(2)}`
    }
    // NOTE: do NOT call onLayerTransformed here — deferred to mouseUp to prevent mesh rebuild during drag
  }

  private onMouseUp = (): void => {
    if (this.dragging && this.dragLayerId) {
      const entry = this.layers.get(this.dragLayerId)
      if (entry) {
        const halfW = this.triggerW / 2
        const posX = entry.mesh.position.x / halfW
        const posY = entry.mesh.position.z / halfW
        this.onLayerTransformed?.(this.dragLayerId, { posX, posY })
      }
    }
    this.dragging = false
    this.dragLayerId = null
    if (this.controls) this.controls.enabled = true
    if (this.coordTip) this.coordTip.style.display = 'none'
  }

  private setMouse(e: MouseEvent): void {
    if (!this.renderer) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this.mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  // ── Animations ────────────────────────────────────────────────────────────

  private playEntranceAnimation(mesh: THREE.Mesh, layer: Layer): void {
    if (!layer.animation) return
    const mat = mesh.material as THREE.MeshLambertMaterial
    const dur = (layer.animationDuration ?? 800) / 1000
    const targetOpacity = layer.opacity
    if (layer.animation === 'fade') {
      mat.opacity = 0
      const start = this.clock.getElapsedTime()
      const tick = () => {
        if (!this.layers.has(layer.id)) return
        const t = Math.min((this.clock.getElapsedTime() - start) / dur, 1)
        mat.opacity = t * targetOpacity
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } else if (layer.animation === 'scale') {
      mesh.scale.set(0, 0, 0)
      const start = this.clock.getElapsedTime()
      const tick = () => {
        if (!this.layers.has(layer.id)) return
        const t = Math.min((this.clock.getElapsedTime() - start) / dur, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        mesh.scale.set(ease, ease, ease)
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calcElevation(layer: Layer): number {
    return (Math.max(0, Math.min(200, layer.posZ)) / 200) * 25 + 1
  }

  private makeTextTexture(text: string, color: string, fontName = 'roboto', extrusion = 0): THREE.CanvasTexture {
    const family = FONT_MAP[fontName] || 'Arial, sans-serif'
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, 1024, 256)
    ctx.font = `bold 120px ${family}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (extrusion > 0) {
      // Draw offset shadow copies to simulate 3D extrusion depth
      const px = Math.max(2, Math.round(extrusion * 120)) // 0–0.15 depth → 0–18 px offset
      const dark = this.darkenColor(color, 0.35)
      for (let i = px; i > 0; i -= Math.max(1, Math.floor(px / 4))) {
        ctx.fillStyle = dark
        ctx.fillText(text, 512 + i * 0.6, 128 + i * 0.6, 960)
      }
    }

    ctx.fillStyle = color
    ctx.fillText(text, 512, 128, 960)
    return new THREE.CanvasTexture(canvas)
  }

  private darkenColor(hex: string, f: number): string {
    try {
      const n = parseInt((hex || '#888888').replace('#', ''), 16)
      const r = Math.round(((n >> 16) & 255) * f)
      const g = Math.round(((n >>  8) & 255) * f)
      const b = Math.round(( n        & 255) * f)
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
    } catch { return '#444444' }
  }

  private typeColor(type: Layer['type']): number {
    const c: Record<Layer['type'], number> = { image: 0x4488ff, video: 0xe63329, gif: 0xff9900, glb: 0xaa44ff, svg: 0x00cc88, texto: 0xffffff }
    return c[type] ?? 0x666666
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate)
    this.controls?.update()
    if (this.boxHelper) this.boxHelper.update()
    const t = this.clock.getElapsedTime()

    this.layers.forEach(entry => {
      const l = entry.layer
      const mesh = entry.mesh
      if (l.animation === 'float') {
        const amp = (l.animationAmplitude ?? 0.04) * (this.triggerW / 2)
        const dur = (l.animationDuration ?? 2000) / 1000
        mesh.position.y = entry.baseElevation + amp * Math.sin((2 * Math.PI * t) / dur)
      } else if (l.animation === 'rotate') {
        const dur = (l.animationDuration ?? 6000) / 1000
        mesh.rotation.y = (2 * Math.PI * t) / dur
      }
    })

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  private onResize = (): void => {
    if (!this.container || !this.camera || !this.renderer) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose(): void {
    cancelAnimationFrame(this.animId)
    window.removeEventListener('resize', this.onResize)
    this.transformControls?.detach()
    this.transformControls?.dispose()
    this.layers.forEach((_, id) => this.removeLayer(id))
    if (this.triggerMesh) {
      ;(this.triggerMesh.material as THREE.MeshLambertMaterial).dispose()
      this.triggerMesh.geometry.dispose()
    }
    this.controls?.dispose()
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }
}
