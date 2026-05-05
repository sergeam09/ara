import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const FONT_MAP = {
    roboto: 'Roboto, Arial, sans-serif',
    montserrat: '"Montserrat", Arial, sans-serif',
    oswald: '"Oswald", "Arial Narrow", sans-serif',
    bebas: '"Bebas Neue", Impact, "Arial Black", sans-serif',
    anton: '"Anton", Impact, "Arial Black", sans-serif',
    righteous: '"Righteous", "Trebuchet MS", sans-serif',
    playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
    merriweather: '"Merriweather", Georgia, serif',
    dancingscript: '"Dancing Script", cursive',
    pacifico: '"Pacifico", cursive',
    permanentmarker: '"Permanent Marker", cursive',
    caveat: '"Caveat", cursive',
    lobster: '"Lobster", cursive',
    greatvibes: '"Great Vibes", cursive',
    sourcecodepro: '"Source Code Pro", "Courier New", Courier, monospace',
    spacemono: '"Space Mono", "Courier New", monospace',
};
const DEG = THREE.MathUtils.degToRad;
const RAD = THREE.MathUtils.radToDeg;
export class Preview3D {
    constructor() {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "camera", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "renderer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "controls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "transformControls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "boxHelper", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "triggerMesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "layers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "animId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "triggerW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 150
        });
        Object.defineProperty(this, "triggerH", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        });
        Object.defineProperty(this, "clock", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new THREE.Clock()
        });
        Object.defineProperty(this, "activeLayerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "dragLayerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dragPlane", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        });
        Object.defineProperty(this, "dragOffset", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new THREE.Vector3()
        });
        Object.defineProperty(this, "raycaster", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new THREE.Raycaster()
        });
        Object.defineProperty(this, "mouse", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new THREE.Vector2()
        });
        Object.defineProperty(this, "tcDragging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "tcMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'translate'
        });
        Object.defineProperty(this, "coordTip", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dimLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onLayerTransformed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onLayerSelected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onGlbDimensions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onMouseDown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (e) => {
                if (!this.camera || !this.renderer || this.tcDragging)
                    return;
                this.setMouse(e);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const tcChildren = [];
                this.transformControls?.traverse(o => { if (o !== this.transformControls)
                    tcChildren.push(o); });
                if (this.raycaster.intersectObjects(tcChildren, false).length > 0)
                    return;
                const layerMeshes = Array.from(this.layers.values())
                    .filter(en => en.glbLoaded && en.mesh.parent)
                    .map(en => en.mesh);
                const hits = this.raycaster.intersectObjects(layerMeshes, true);
                if (hits.length > 0) {
                    let obj = hits[0].object;
                    while (obj.parent && !obj.userData.layerId)
                        obj = obj.parent;
                    const id = obj.userData.layerId;
                    if (!id)
                        return;
                    this.onLayerSelected?.(id);
                    if (this.tcMode !== 'translate')
                        return;
                    this.dragging = true;
                    this.dragLayerId = id;
                    if (this.controls)
                        this.controls.enabled = false;
                    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -hits[0].object.position.y);
                    const pt = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(this.dragPlane, pt);
                    this.dragOffset.copy(pt).sub(obj.position);
                    e.stopPropagation();
                }
            }
        });
        Object.defineProperty(this, "onMouseMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (e) => {
                if (!this.dragging || !this.dragLayerId || !this.camera)
                    return;
                this.setMouse(e);
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const pt = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, pt);
                const entry = this.layers.get(this.dragLayerId);
                if (!entry)
                    return;
                const newPos = pt.clone().sub(this.dragOffset);
                entry.mesh.position.x = newPos.x;
                entry.mesh.position.z = newPos.z;
                if (this.boxHelper && this.boxHelper.parent)
                    this.boxHelper.update();
                const halfW = this.triggerW / 2;
                if (this.coordTip && this.renderer) {
                    const rect = this.renderer.domElement.getBoundingClientRect();
                    this.coordTip.style.left = `${e.clientX - rect.left + 14}px`;
                    this.coordTip.style.top = `${e.clientY - rect.top - 28}px`;
                    this.coordTip.style.display = 'block';
                    this.coordTip.textContent = `X ${(newPos.x / halfW).toFixed(2)}  Y ${(newPos.z / halfW).toFixed(2)}`;
                }
            }
        });
        Object.defineProperty(this, "onMouseUp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (this.dragging && this.dragLayerId) {
                    const entry = this.layers.get(this.dragLayerId);
                    if (entry) {
                        const halfW = this.triggerW / 2;
                        this.onLayerTransformed?.(this.dragLayerId, {
                            posX: entry.mesh.position.x / halfW,
                            posY: entry.mesh.position.z / halfW
                        });
                    }
                }
                this.dragging = false;
                this.dragLayerId = null;
                if (this.controls)
                    this.controls.enabled = true;
                if (this.coordTip)
                    this.coordTip.style.display = 'none';
            }
        });
        Object.defineProperty(this, "animate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.animId = requestAnimationFrame(this.animate);
                this.controls?.update();
                // Safe boxHelper update — only when object is actually in the scene
                if (this.boxHelper && this.boxHelper.parent) {
                    this.boxHelper.update();
                }
                const t = this.clock.getElapsedTime();
                this.layers.forEach(entry => {
                    if (!entry.glbLoaded || !entry.mesh.parent)
                        return;
                    const l = entry.layer;
                    const mesh = entry.mesh;
                    if (l.animation === 'float') {
                        const amp = (l.animationAmplitude ?? 0.04) * (this.triggerW / 2);
                        const dur = (l.animationDuration ?? 2000) / 1000;
                        const axis = l.animationAxis || 'y';
                        const bx = (l.posX ?? 0) * (this.triggerW / 2);
                        const bz = (l.posY ?? 0) * (this.triggerW / 2);
                        const wave = amp * Math.sin((2 * Math.PI * t) / dur);
                        mesh.position.x = axis === 'x' ? bx + wave : bx;
                        mesh.position.y = axis === 'y' ? entry.baseElevation + wave : entry.baseElevation;
                        mesh.position.z = axis === 'z' ? bz + wave : bz;
                    }
                    else if (l.animation === 'rotate') {
                        const dur = (l.animationDuration ?? 6000) / 1000;
                        const axis = l.animationAxis || 'y';
                        mesh.rotation.x = axis === 'x' ? (2 * Math.PI * t) / dur : DEG(l.rotX ?? 0);
                        mesh.rotation.y = axis === 'y' ? (2 * Math.PI * t) / dur : DEG(l.rotY ?? 0);
                        mesh.rotation.z = axis === 'z' ? (2 * Math.PI * t) / dur : DEG(l.rotZ ?? 0);
                    }
                });
                if (this.renderer && this.scene && this.camera) {
                    this.renderer.render(this.scene, this.camera);
                }
            }
        });
        Object.defineProperty(this, "onResize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (!this.container || !this.camera || !this.renderer)
                    return;
                const w = this.container.clientWidth;
                const h = this.container.clientHeight;
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(w, h);
            }
        });
    }
    init(container) {
        this.container = container;
        container.style.position = 'relative';
        const tip = document.createElement('div');
        tip.style.cssText = 'position:absolute;background:rgba(0,0,0,0.85);color:#e63329;font-size:10px;font-weight:700;font-family:monospace;padding:4px 9px;border-radius:4px;pointer-events:none;display:none;z-index:20;white-space:nowrap;border:1px solid rgba(230,51,41,0.4);';
        container.appendChild(tip);
        this.coordTip = tip;
        const dim = document.createElement('div');
        dim.style.cssText = 'position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.7);color:#aaa;font-size:10px;font-family:monospace;padding:3px 8px;border-radius:4px;pointer-events:none;display:none;z-index:20;';
        container.appendChild(dim);
        this.dimLabel = dim;
        const modeBar = document.createElement('div');
        modeBar.style.cssText = 'position:absolute;top:10px;right:10px;z-index:25;display:flex;gap:6px;';
        modeBar.innerHTML = `
      <button id="tc-btn-translate" style="background:#1a1a1a;border:2px solid #e63329;color:#e63329;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:0.04em;font-family:monospace;">↔ MOVER</button>
      <button id="tc-btn-rotate" style="background:#1a1a1a;border:2px solid #444;color:#666;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:0.04em;font-family:monospace;">↻ ROTAR</button>
    `;
        container.appendChild(modeBar);
        modeBar.querySelector('#tc-btn-translate')?.addEventListener('click', () => this.setTransformMode('translate'));
        modeBar.querySelector('#tc-btn-rotate')?.addEventListener('click', () => this.setTransformMode('rotate'));
        document.addEventListener('keydown', (ev) => {
            if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement)
                return;
            if (ev.key === 'w' || ev.key === 'W')
                this.setTransformMode('translate');
            if (ev.key === 'e' || ev.key === 'E')
                this.setTransformMode('rotate');
        });
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 600;
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
        this.camera.position.set(0, 220, 280);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 1200;
        this.controls.target.set(0, 0, 0);
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.setSize(0.75);
        this.scene.add(this.transformControls);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.tcDragging = event.value;
            if (this.controls)
                this.controls.enabled = !event.value;
            if (!event.value) {
                const obj = this.transformControls?.object;
                if (obj)
                    this.fireTCCallback(obj);
                if (this.coordTip)
                    this.coordTip.style.display = 'none';
            }
        });
        this.transformControls.addEventListener('objectChange', () => {
            const obj = this.transformControls?.object;
            if (obj && this.tcDragging)
                this.updateTCTip(obj);
        });
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5);
        dir.position.set(100, 300, 150);
        this.scene.add(dir);
        const grid = new THREE.GridHelper(600, 60, 0x2a2a2a, 0x1a1a1a);
        grid.position.y = -1;
        this.scene.add(grid);
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('mouseleave', this.onMouseUp);
        window.addEventListener('resize', this.onResize);
        this.clock.start();
        this.animate();
    }
    setTransformMode(mode) {
        this.tcMode = mode;
        this.transformControls?.setMode(mode);
        const btnT = this.container?.querySelector('#tc-btn-translate');
        const btnR = this.container?.querySelector('#tc-btn-rotate');
        if (btnT) {
            btnT.style.borderColor = mode === 'translate' ? '#e63329' : '#444';
            btnT.style.color = mode === 'translate' ? '#e63329' : '#888';
        }
        if (btnR) {
            btnR.style.borderColor = mode === 'rotate' ? '#e63329' : '#444';
            btnR.style.color = mode === 'rotate' ? '#e63329' : '#888';
        }
    }
    selectLayer(id) {
        this.activeLayerId = id;
        if (!this.transformControls || !this.scene)
            return;
        if (this.boxHelper) {
            this.scene.remove(this.boxHelper);
            this.boxHelper = null;
        }
        if (this.dimLabel)
            this.dimLabel.style.display = 'none';
        if (!id) {
            this.transformControls.detach();
            return;
        }
        const entry = this.layers.get(id);
        if (!entry) {
            this.transformControls.detach();
            return;
        }
        // GLB still loading — do NOT attach TransformControls
        if (!entry.glbLoaded) {
            this.transformControls.detach();
            return;
        }
        if (entry.mesh && entry.mesh.parent) {
            this.transformControls.attach(entry.mesh);
            this.boxHelper = new THREE.BoxHelper(entry.mesh, 0xe63329);
            this.scene.add(this.boxHelper);
            this.showDimLabel(entry.mesh, entry.layer);
        }
    }
    showDimLabel(mesh, layer) {
        if (!this.dimLabel)
            return;
        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = bbox.getSize(new THREE.Vector3());
        const halfW = this.triggerW / 2;
        const wx = (size.x / halfW).toFixed(2);
        const wz = (size.z / halfW).toFixed(2);
        const typeLabel = layer.type === 'texto' ? 'Texto' : layer.type.toUpperCase();
        this.dimLabel.textContent = `${typeLabel}  ${wx} × ${wz} u  |  escala ${(layer.scale ?? 1).toFixed(2)}×  |  Z ${layer.posZ ?? 0}`;
        this.dimLabel.style.display = 'block';
    }
    addLayer(layer, triggerWidth) {
        this.updateLayer(layer, triggerWidth);
    }
    updateLayer(layer, triggerWidth) {
        if (!this.scene)
            return;
        this.triggerW = triggerWidth;
        const wasActive = this.activeLayerId === layer.id;
        if (wasActive) {
            this.transformControls?.detach();
            if (this.boxHelper) {
                this.scene.remove(this.boxHelper);
                this.boxHelper = null;
            }
            if (this.dimLabel)
                this.dimLabel.style.display = 'none';
        }
        this.removeLayer(layer.id);
        const baseElevation = this.calcElevation(layer);
        const half = triggerWidth / 2;
        // ── GLB — async load, no placeholder in scene ─────────────────────────
        if ((layer.type === 'glb' || layer.type === 'gltf' || layer.type === 'model') && layer.file) {
            const objectURL = URL.createObjectURL(layer.file);
            // Store entry with glbLoaded=false — mesh is a dummy NOT in the scene
            const dummy = new THREE.Object3D();
            dummy.userData = { layerId: layer.id, isLayer: true };
            this.layers.set(layer.id, { mesh: dummy, objectURL, layer: { ...layer }, baseElevation, glbLoaded: false });
            const loader = new GLTFLoader();
            loader.load(objectURL, (gltf) => {
                if (!this.scene || !this.layers.has(layer.id))
                    return;
                const model = gltf.scene;
                model.userData = { layerId: layer.id, isLayer: true };
                // Calculate raw bounding box BEFORE scaling
                const rawBbox = new THREE.Box3().setFromObject(gltf.scene);
                const rawSize = rawBbox.getSize(new THREE.Vector3());
                // Scale: defaultScale fills half the trigger regardless of GLTF units.
                // When user sets real dimensions, apply a ratio over the raw cm measurement.
                // rawSize is in GLTF meters → rawSize * 100 = cm equivalent.
                const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
                const defaultScale = ((layer.scale ?? 1) * triggerWidth * 0.5) / rawMaxDim;
                const toCm = (v) => layer.unidadReal === 'm' ? v * 100 : v;
                let scaleFactor;
                if (layer.anchoReal && layer.anchoReal > 0 && rawSize.x > 0) {
                    scaleFactor = defaultScale * (toCm(layer.anchoReal) / (rawSize.x * 100));
                }
                else if (layer.altoReal && layer.altoReal > 0 && rawSize.y > 0) {
                    scaleFactor = defaultScale * (toCm(layer.altoReal) / (rawSize.y * 100));
                }
                else if (layer.profReal && layer.profReal > 0 && rawSize.z > 0) {
                    scaleFactor = defaultScale * (toCm(layer.profReal) / (rawSize.z * 100));
                }
                else {
                    scaleFactor = defaultScale;
                }
                model.scale.setScalar(scaleFactor);
                // Center model on its own origin
                const bbox = new THREE.Box3().setFromObject(model);
                const center = bbox.getCenter(new THREE.Vector3());
                model.position.sub(center);
                // Apply layer position and rotation
                model.position.x += (layer.posX ?? 0) * half;
                model.position.y += baseElevation;
                model.position.z += (layer.posY ?? 0) * half;
                model.rotation.set(DEG(layer.rotX ?? 0), DEG(layer.rotY ?? 0), DEG(layer.rotZ ?? 0));
                this.scene.add(model);
                // Update entry
                const entry = this.layers.get(layer.id);
                if (entry) {
                    entry.mesh = model;
                    entry.glbLoaded = true;
                }
                // Fire dimensions callback ONLY on first load (when no real dims set yet)
                if (layer.anchoReal == null && layer.altoReal == null && layer.profReal == null) {
                    this.onGlbDimensions?.(layer.id, {
                        ancho: parseFloat((rawSize.x * 100).toFixed(1)),
                        alto: parseFloat((rawSize.y * 100).toFixed(1)),
                        prof: parseFloat((rawSize.z * 100).toFixed(1))
                    });
                }
                // If still active layer AND model is still in scene (not removed by subscriber reload)
                if (this.activeLayerId === layer.id && this.transformControls && this.scene && model.parent) {
                    this.transformControls.attach(model);
                    this.boxHelper = new THREE.BoxHelper(model, 0xe63329);
                    this.scene.add(this.boxHelper);
                    this.showDimLabel(model, layer);
                }
            }, undefined, (err) => {
                console.error('GLB load error:', err);
            });
            return;
        }
        // ── Non-GLB layers ────────────────────────────────────────────────────
        const aspect = (layer.naturalWidth && layer.naturalHeight)
            ? layer.naturalWidth / layer.naturalHeight
            : layer.type === 'texto' ? 4 : 1;
        const textoScale = layer.type === 'texto' ? Math.max(0.25, (layer.tamanoTexto ?? 0.5) * 2) : 1;
        const w = triggerWidth * (layer.scale ?? 1) * textoScale;
        const h = w / aspect;
        const geo = new THREE.PlaneGeometry(w, h);
        geo.rotateX(-Math.PI / 2);
        let mat;
        let objectURL;
        let videoEl;
        if (layer.file && layer.file.type.startsWith('video/')) {
            objectURL = URL.createObjectURL(layer.file);
            videoEl = document.createElement('video');
            videoEl.src = objectURL;
            videoEl.muted = true;
            videoEl.loop = true;
            videoEl.playsInline = true;
            videoEl.crossOrigin = 'anonymous';
            videoEl.play().catch(() => { });
            mat = new THREE.MeshLambertMaterial({ map: new THREE.VideoTexture(videoEl), transparent: true, opacity: layer.opacity ?? 1, side: THREE.DoubleSide, depthWrite: false });
        }
        else if (layer.file && layer.file.type.startsWith('image/')) {
            objectURL = URL.createObjectURL(layer.file);
            mat = new THREE.MeshLambertMaterial({ map: new THREE.TextureLoader().load(objectURL), transparent: true, opacity: layer.opacity ?? 1, side: THREE.DoubleSide, depthWrite: false });
        }
        else if (layer.type === 'texto') {
            mat = new THREE.MeshLambertMaterial({ map: this.makeTextTexture(layer.texto || 'Texto AR', layer.colorTexto || '#ffffff', layer.fontTexto || 'roboto'), transparent: true, opacity: layer.opacity ?? 1, side: THREE.DoubleSide, depthWrite: false });
        }
        else {
            mat = new THREE.MeshLambertMaterial({ color: this.typeColor(layer.type), transparent: true, opacity: layer.file ? 0.45 : 0.3, side: THREE.DoubleSide, wireframe: !layer.file });
        }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { layerId: layer.id, isLayer: true };
        mesh.position.set((layer.posX ?? 0) * half, baseElevation, (layer.posY ?? 0) * half);
        mesh.rotation.set(DEG(layer.rotX ?? 0), DEG(layer.rotY ?? 0), DEG(layer.rotZ ?? 0));
        this.scene.add(mesh);
        this.layers.set(layer.id, { mesh, objectURL, videoEl, layer: { ...layer }, baseElevation, glbLoaded: true });
        if (wasActive && this.transformControls) {
            this.transformControls.attach(mesh);
            this.boxHelper = new THREE.BoxHelper(mesh, 0xe63329);
            this.scene.add(this.boxHelper);
            this.showDimLabel(mesh, layer);
        }
        this.playEntranceAnimation(mesh, layer);
    }
    removeLayer(id) {
        const entry = this.layers.get(id);
        if (!entry || !this.scene)
            return;
        if (this.transformControls?.object === entry.mesh) {
            this.transformControls.detach();
        }
        if (this.boxHelper) {
            this.scene.remove(this.boxHelper);
            this.boxHelper = null;
        }
        if (entry.mesh.parent)
            this.scene.remove(entry.mesh);
        entry.mesh.traverse((child) => {
            if (child.isMesh) {
                const m = child;
                if (m.geometry)
                    m.geometry.dispose();
                if (Array.isArray(m.material))
                    m.material.forEach(mat => mat.dispose());
                else if (m.material)
                    m.material.dispose();
            }
        });
        if (entry.videoEl) {
            entry.videoEl.pause();
            entry.videoEl.src = '';
        }
        if (entry.objectURL)
            URL.revokeObjectURL(entry.objectURL);
        this.layers.delete(id);
    }
    setTriggerImage(dataURL, width, height) {
        if (!this.scene)
            return;
        this.triggerW = width;
        this.triggerH = height;
        if (this.triggerMesh) {
            this.scene.remove(this.triggerMesh);
            this.triggerMesh.material.map?.dispose();
            this.triggerMesh.material.dispose();
            this.triggerMesh.geometry.dispose();
        }
        const geo = new THREE.PlaneGeometry(width, height);
        geo.rotateX(-Math.PI / 2);
        this.triggerMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
            map: new THREE.TextureLoader().load(dataURL),
            transparent: true, opacity: 0.92, side: THREE.DoubleSide
        }));
        this.triggerMesh.userData = { isTrigger: true };
        this.scene.add(this.triggerMesh);
    }
    fireTCCallback(mesh) {
        const id = mesh.userData.layerId;
        if (!id)
            return;
        const halfW = this.triggerW / 2;
        if (this.tcMode === 'translate') {
            const posX = mesh.position.x / halfW;
            const posY = mesh.position.z / halfW;
            const posZ = Math.round(Math.max(0, Math.min(200, (mesh.position.y - 1) * 8)));
            const entry = this.layers.get(id);
            if (entry)
                entry.baseElevation = mesh.position.y;
            this.onLayerTransformed?.(id, { posX, posY, posZ });
        }
        else {
            const rotX = Math.round(RAD(mesh.rotation.x));
            const rotY = Math.round(RAD(mesh.rotation.y));
            const rotZ = Math.round(RAD(mesh.rotation.z));
            this.onLayerTransformed?.(id, { rotX, rotY, rotZ });
        }
    }
    updateTCTip(mesh) {
        if (!this.coordTip)
            return;
        const halfW = this.triggerW / 2;
        let text;
        if (this.tcMode === 'translate') {
            const posX = mesh.position.x / halfW;
            const posY = mesh.position.z / halfW;
            const posZ = Math.round(Math.max(0, Math.min(200, (mesh.position.y - 1) * 8)));
            text = `X ${posX >= 0 ? '+' : ''}${posX.toFixed(2)}  Y ${posY >= 0 ? '+' : ''}${posY.toFixed(2)}  Z ${posZ}`;
        }
        else {
            text = `RX ${Math.round(RAD(mesh.rotation.x))}°  RY ${Math.round(RAD(mesh.rotation.y))}°  RZ ${Math.round(RAD(mesh.rotation.z))}°`;
        }
        this.coordTip.style.left = '8px';
        this.coordTip.style.top = '8px';
        this.coordTip.style.display = 'block';
        this.coordTip.textContent = text;
    }
    setMouse(e) {
        if (!this.renderer)
            return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
    playEntranceAnimation(mesh, layer) {
        if (!layer.animation)
            return;
        const mat = mesh.material;
        const dur = (layer.animationDuration ?? 800) / 1000;
        const targetOpacity = layer.opacity ?? 1;
        if (layer.animation === 'fade') {
            mat.opacity = 0;
            const start = this.clock.getElapsedTime();
            const tick = () => {
                if (!this.layers.has(layer.id))
                    return;
                const t = Math.min((this.clock.getElapsedTime() - start) / dur, 1);
                mat.opacity = t * targetOpacity;
                if (t < 1)
                    requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
        else if (layer.animation === 'scale') {
            mesh.scale.set(0, 0, 0);
            const start = this.clock.getElapsedTime();
            const tick = () => {
                if (!this.layers.has(layer.id))
                    return;
                const t = Math.min((this.clock.getElapsedTime() - start) / dur, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                mesh.scale.set(ease, ease, ease);
                if (t < 1)
                    requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
    }
    calcElevation(layer) {
        return (Math.max(0, Math.min(200, layer.posZ ?? 0)) / 200) * 25 + 1;
    }
    makeTextTexture(text, color, fontName = 'roboto') {
        const family = FONT_MAP[fontName] || 'Arial, sans-serif';
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, 1024, 256);
        ctx.font = `bold 120px ${family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(text, 512, 128, 960);
        const texture = new THREE.CanvasTexture(canvas);
        document.fonts.load(`bold 120px ${family}`).then(() => {
            ctx.clearRect(0, 0, 1024, 256);
            ctx.font = `bold 120px ${family}`;
            ctx.fillStyle = color;
            ctx.fillText(text, 512, 128, 960);
            texture.needsUpdate = true;
        }).catch(() => { });
        return texture;
    }
    typeColor(type) {
        const c = { image: 0x4488ff, video: 0xe63329, gif: 0xff9900, glb: 0xaa44ff, gltf: 0xaa44ff, model: 0xaa44ff, svg: 0x00cc88, texto: 0xffffff };
        return c[type] ?? 0x666666;
    }
    dispose() {
        cancelAnimationFrame(this.animId);
        window.removeEventListener('resize', this.onResize);
        this.transformControls?.detach();
        this.transformControls?.dispose();
        this.layers.forEach((_, id) => this.removeLayer(id));
        if (this.triggerMesh) {
            ;
            this.triggerMesh.material.dispose();
            this.triggerMesh.geometry.dispose();
        }
        this.controls?.dispose();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
