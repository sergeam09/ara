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

// Maps A-Frame font names to system font stacks for canvas preview
const FONT_MAP: Record<string, string> = {
  roboto:          'Roboto, Arial, sans-serif',
  ubuntu:          'Ubuntu, sans-serif',
  dejavu:          '"DejaVu Sans", Arial, sans-serif',
  exo2bold:        '"Exo 2", sans-serif',
  exo2semibold:    '"Exo 2", sans-serif',
  kelsonsans:      'sans-serif',
  sourcecodepro:   '"Source Code Pro", Courier, monospace',
  aileronsemibold: 'Arial, sans-serif',
}

export class Preview3D {
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private controls: OrbitControls | null = null
  private transformControls: TransformControls | null = null
  private triggerMesh: THREE.Mesh | null = null
  private layers: Map<string, LayerEntry> = new Map()
  private container: HTMLElement | null = null
  private animId = 0
  private triggerW = 150
  private triggerH = 100
  private clock = new THREE.Clock()

  // Drag state (free-drag on XZ plane)
  private dragging = false
  private dragLayerId: string | null = null
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private dragOffset = new THREE.Vector3()
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private coordTip: HTMLDivElement | null = null

  // Callback when layer is moved (drag or transform controls)
  onLayerMoved: ((id: string, posX: number, posY: number, posZ?: number) => void) | null = null

  init(container: HTMLElement): void {
    this.container = container
    container.style.position = 'relative'

    // Coordinate tooltip
    const tip = document.createElement('div')
    tip.style.cssText = 'position:absolute;background:rgba(0,0,0,0.82);color:#e63329;font-size:10px;font-weight:700;font-family:monospace;padding:4px 9px;border-radius:4px;pointer-events:none;display:none;z-index:20;white-space:nowrap;border:1px solid rgba(230,51,41,0.4);letter-spacing:0.04em;'
    container.appendChild(tip)
    this.coordTip = tip

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

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 50
    this.controls.maxDistance = 1200
    this.controls.target.set(0, 0, 0)

    // TransformControls gizmo
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement)
    this.transformControls.setMode('translate')
    this.transformControls.setSize(0.75)
    this.transformControls.addEventListener('dragging-changed', (event: any) => {
      if (this.controls) this.controls.enabled = !event.value
      if (!event.value && this.coordTip) this.coordTip.style.display = 'none'
    })
    this.transformControls.addEventListener('objectChange', () => {
      this.syncTransformToCallback()
    })
    this.scene.add(this.transformControls as unknown as THREE.Object3D)

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dir = new THREE.DirectionalLight(0xffffff, 0.5)
    dir.position.set(100, 300, 150)
    this.scene.add(dir)

    // Grid
    const grid = new THREE.GridHelper(600, 60, 0x2a2a2a, 0x1a1a1a)
    grid.position.y = -1
    this.scene.add(grid)

    // Free-drag events (XZ plane)
    const canvas = this.renderer.domElement
    canvas.addEventListener('mousedown',  this.onMouseDown)
    canvas.addEventListener('mousemove',  this.onMouseMove)
    canvas.addEventListener('mouseup',    this.onMouseUp)
    canvas.addEventListener('mouseleave', this.onMouseUp)

    window.addEventListener('resize', this.onResize)
    this.clock.start()
    this.animate()
  }

  // Attach TransformControls to a layer (call when user selects a layer)
  selectLayer(id: string | null): void {
    if (!this.transformControls) return
    if (!id) {
      this.transformControls.detach()
      return
    }
    const entry = this.layers.get(id)
    if (entry) this.transformControls.attach(entry.mesh)
  }

  setTriggerImage(dataURL: string, width: number, height: number): void {
    if (!this.scene) return
    this.triggerW = width
    this.triggerH = height

    if (this.triggerMesh) {
      this.scene.remove(this.triggerMesh)
      ;(this.triggerMesh.material as THREE.MeshLambertMaterial).map?.dispose()
      ;(this.triggerMesh.material as THREE.MeshLambertMaterial).dispose()
      this.triggerMesh.geometry.dispose()
    }

    const texture = new THREE.TextureLoader().load(dataURL)
    const geo = new THREE.PlaneGeometry(width, height)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshLambertMaterial({
      map: texture, transparent: true, opacity: 0.92, side: THREE.DoubleSide
    })
    this.triggerMesh = new THREE.Mesh(geo, mat)
    this.triggerMesh.position.y = 0
    this.triggerMesh.userData = { isTrigger: true }
    this.scene.add(this.triggerMesh)
  }

  addLayer(layer: Layer, triggerWidth: number): void {
    this.updateLayer(layer, triggerWidth)
  }

  updateLayer(layer: Layer, triggerWidth: number): void {
    if (!this.scene) return

    // If TC is attached to this layer, detach before rebuilding
    const wasSelected = (this.transformControls as any)?.object?.userData?.layerId === layer.id
    if (wasSelected) this.transformControls?.detach()

    this.removeLayer(layer.id)

    // Aspect ratio: use natural dimensions, or 4:1 for text (canvas texture), or 1:1
    const aspect = (layer.naturalWidth && layer.naturalHeight)
      ? layer.naturalWidth / layer.naturalHeight
      : layer.type === 'texto'
        ? 4
        : 1
    const w = triggerWidth * layer.scale
    const h = w / aspect
    const geo = new THREE.PlaneGeometry(w, h)
    geo.rotateX(-Math.PI / 2)

    let mat: THREE.MeshLambertMaterial
    let objectURL: string | undefined
    let videoEl: HTMLVideoElement | undefined

    if (layer.file && layer.file.type.startsWith('video/')) {
      objectURL = URL.createObjectURL(layer.file)
      videoEl = document.createElement('video')
      videoEl.src = objectURL
      videoEl.muted = true
      videoEl.loop = true
      videoEl.playsInline = true
      videoEl.crossOrigin = 'anonymous'
      videoEl.play().catch(() => {})
      const texture = new THREE.VideoTexture(videoEl)
      mat = new THREE.MeshLambertMaterial({
        map: texture, transparent: true, opacity: layer.opacity,
        side: THREE.DoubleSide, depthWrite: false
      })
    } else if (layer.file && layer.file.type.startsWith('image/')) {
      objectURL = URL.createObjectURL(layer.file)
      const texture = new THREE.TextureLoader().load(objectURL)
      mat = new THREE.MeshLambertMaterial({
        map: texture, transparent: true, opacity: layer.opacity,
        side: THREE.DoubleSide, depthWrite: false
      })
    } else if (layer.type === 'texto') {
      const texture = this.makeTextTexture(
        layer.texto || 'Texto AR',
        layer.colorTexto || '#ffffff',
        layer.fontTexto || 'roboto'
      )
      mat = new THREE.MeshLambertMaterial({
        map: texture, transparent: true, opacity: layer.opacity,
        side: THREE.DoubleSide, depthWrite: false
      })
    } else {
      mat = new THREE.MeshLambertMaterial({
        color: this.typeColor(layer.type),
        transparent: true,
        opacity: layer.file ? 0.45 : 0.3,
        side: THREE.DoubleSide,
        wireframe: !layer.file
      })
    }

    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData = { layerId: layer.id, isLayer: true }
    const baseElevation = this.calcElevation(layer)
    mesh.position.set(layer.posX * (this.triggerW / 2), baseElevation, layer.posY * (this.triggerW / 2))
    this.scene.add(mesh)
    this.layers.set(layer.id, { mesh, objectURL, videoEl, layer: { ...layer }, baseElevation })

    // Re-attach TC if this layer was selected
    if (wasSelected) this.transformControls?.attach(mesh)

    // Entrance animation preview (one-shot)
    this.playEntranceAnimation(mesh, layer)
  }

  removeLayer(id: string): void {
    const entry = this.layers.get(id)
    if (!entry || !this.scene) return
    if ((this.transformControls as any)?.object === entry.mesh) this.transformControls?.detach()
    this.scene.remove(entry.mesh)
    ;(entry.mesh.material as THREE.MeshLambertMaterial).map?.dispose()
    ;(entry.mesh.material as THREE.MeshLambertMaterial).dispose()
    entry.mesh.geometry.dispose()
    if (entry.videoEl) { entry.videoEl.pause(); entry.videoEl.src = '' }
    if (entry.objectURL) URL.revokeObjectURL(entry.objectURL)
    this.layers.delete(id)
  }

  // ── Entrance animation (one-shot preview) ────────────────────────────────

  private playEntranceAnimation(mesh: THREE.Mesh, layer: Layer): void {
    if (!layer.animation) return
    const mat = mesh.material as THREE.MeshLambertMaterial
    const dur = (layer.animationDuration ?? 800) / 1000
    const targetOpacity = layer.opacity
    const startScale = mesh.scale.clone()

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
        const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
        mesh.scale.set(ease, ease, ease)
        if (t < 1) requestAnimationFrame(tick)
        else mesh.scale.copy(startScale)
      }
      requestAnimationFrame(tick)
    }
  }

  // ── TransformControls sync ───────────────────────────────────────────────

  private syncTransformToCallback(): void {
    if (!this.transformControls?.object) return
    const mesh = this.transformControls.object as THREE.Mesh
    const id = mesh.userData.layerId as string
    if (!id) return

    const halfW = this.triggerW / 2
    const posX = mesh.position.x / halfW
    const posY = mesh.position.z / halfW
    // elevation = (posZ/200)*25+1  →  posZ = (elevation-1)*200/25 = (elevation-1)*8
    const posZ = Math.round(Math.max(0, Math.min(200, (mesh.position.y - 1) * 8)))

    // Update baseElevation in entry so animation loop uses correct base
    const entry = this.layers.get(id)
    if (entry) entry.baseElevation = mesh.position.y

    if (this.coordTip) {
      this.coordTip.style.cssText += ';display:block;left:8px;top:8px;'
      this.coordTip.textContent = `X ${posX >= 0 ? '+' : ''}${posX.toFixed(2)}  Y ${posY >= 0 ? '+' : ''}${posY.toFixed(2)}  Z ${posZ}`
    }

    this.onLayerMoved?.(id, posX, posY, posZ)
  }

  // ── Free-drag (XZ plane) ──────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.camera || !this.renderer) return
    // Don't start free-drag if TransformControls is consuming the event
    if (this.transformControls?.dragging) return

    this.setMouse(e)
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const layerMeshes = Array.from(this.layers.values()).map(en => en.mesh)
    const hits = this.raycaster.intersectObjects(layerMeshes, false)

    if (hits.length > 0) {
      const hit = hits[0]
      const id = hit.object.userData.layerId as string
      if (!id) return
      this.dragging = true
      this.dragLayerId = id
      if (this.controls) this.controls.enabled = false
      const layerY = hit.object.position.y
      this.dragPlane.set(new THREE.Vector3(0, 1, 0), -layerY)
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
    entry.baseElevation = entry.mesh.position.y
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
    this.onLayerMoved?.(this.dragLayerId, posX, posY)
  }

  private onMouseUp = (): void => {
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calcElevation(layer: Layer): number {
    return (Math.max(0, Math.min(200, layer.posZ)) / 200) * 25 + 1
  }

  private makeTextTexture(text: string, color: string, fontName = 'roboto'): THREE.CanvasTexture {
    const family = FONT_MAP[fontName] || 'Arial, sans-serif'
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, 1024, 256)
    ctx.fillStyle = color
    ctx.font = `bold 120px ${family}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 512, 128, 960)
    return new THREE.CanvasTexture(canvas)
  }

  private typeColor(type: Layer['type']): number {
    const colors: Record<Layer['type'], number> = {
      image: 0x4488ff, video: 0xe63329, gif: 0xff9900,
      glb: 0xaa44ff, svg: 0x00cc88, texto: 0xffffff
    }
    return colors[type] ?? 0x666666
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate)
    this.controls?.update()
    const t = this.clock.getElapsedTime()

    this.layers.forEach((entry) => {
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
