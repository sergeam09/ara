import { TriggerUploader } from './TriggerUploader';
import { LayerManager } from './LayerManager';
import { Preview3D } from './Preview3D';
import { Publisher } from './Publisher';
import { deleteProject } from '@/utils/WorkerClient';
function trackProject(slug, nombre, url) {
    const key = 'ara_projects';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const existing = list.findIndex(p => p.slug === slug);
    const entry = { slug, nombre, url, publishedAt: new Date().toISOString() };
    if (existing >= 0)
        list[existing] = entry;
    else
        list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list));
}
function loadProjects() {
    return JSON.parse(localStorage.getItem('ara_projects') || '[]');
}
const triggerUploader = new TriggerUploader();
const layerManager = new LayerManager();
const preview3D = new Preview3D();
const publisher = new Publisher();
let triggerWidth = 150;
let triggerHeight = 100;
let arModo = 'image';
const TYPE_ICONS = {
    image: '◈', video: '▶', gif: '⟳', glb: '⬡', texto: 'T', svg: '⬟'
};
const TYPE_ACCEPT = {
    image: 'image/jpeg,image/png,image/webp',
    gif: 'image/gif,image/apng',
    video: 'video/mp4,video/webm,video/quicktime',
    glb: '.glb,.gltf',
    svg: 'image/svg+xml',
    texto: ''
};
// ── Trigger UI ─────────────────────────────────────────────────────────────
function setupTriggerUpload() {
    const zone = document.getElementById('triggerUploadZone');
    const fileInput = document.getElementById('fileTrigger');
    const loaded = document.getElementById('triggerLoaded');
    const thumb = document.getElementById('triggerThumb');
    const nameEl = document.getElementById('triggerName');
    const btnChange = document.getElementById('btnChangeTrigger');
    const openPicker = () => fileInput.click();
    zone.addEventListener('click', openPicker);
    btnChange.addEventListener('click', openPicker);
    // Drag & drop
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        const file = e.dataTransfer?.files[0];
        if (file)
            await loadTriggerFile(file);
    });
    fileInput.addEventListener('change', async () => {
        if (fileInput.files?.[0])
            await loadTriggerFile(fileInput.files[0]);
        fileInput.value = '';
    });
    async function loadTriggerFile(file) {
        try {
            const { dimensions } = await triggerUploader.handleFile(file);
            const maxDim = Math.max(dimensions.width, dimensions.height);
            triggerWidth = (dimensions.width / maxDim) * 150;
            triggerHeight = (dimensions.height / maxDim) * 150;
            const url = await triggerUploader.getTriggerDataURL();
            thumb.src = url;
            nameEl.textContent = file.name;
            zone.style.display = 'none';
            loaded.classList.add('show');
            preview3D.setTriggerImage(url, triggerWidth, triggerHeight);
            // Refresh all existing layers in preview
            layerManager.getAllLayers().forEach(l => preview3D.updateLayer(l, triggerWidth));
        }
        catch (err) {
            alert(`Error cargando trigger: ${err instanceof Error ? err.message : err}`);
        }
    }
}
// ── Layers UI ───────────────────────────────────────────────────────────────
function renderLayersList(layers, activeId) {
    const container = document.getElementById('layersList');
    const empty = document.getElementById('layersEmpty');
    const title = document.getElementById('layersTitle');
    title.textContent = `Capas (${layers.length})`;
    if (layers.length === 0) {
        empty.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    empty.style.display = 'none';
    container.innerHTML = layers.map((layer, i) => {
        const icon = TYPE_ICONS[layer.type] || '?';
        const label = layer.type === 'texto'
            ? (layer.texto || 'Texto AR')
            : (layer.file ? layer.file.name : 'Sin archivo');
        const isEmpty = layer.type !== 'texto' && !layer.file;
        return `
    <div class="layer-item ${layer.id === activeId ? 'active' : ''}" data-id="${layer.id}">
      <div class="layer-num">${i + 1}</div>
      <div class="layer-type-icon">${icon}</div>
      <div class="layer-label ${isEmpty ? 'empty' : ''}">${label}</div>
      <button class="layer-del" data-del="${layer.id}" title="Eliminar">✕</button>
    </div>`;
    }).join('');
    container.querySelectorAll('.layer-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.getAttribute('data-id');
            if (id)
                layerManager.selectLayer(id);
        });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.getAttribute('data-del');
            if (id) {
                preview3D.removeLayer(id);
                layerManager.deleteLayer(id);
            }
        });
    });
}
// ── Props panel ─────────────────────────────────────────────────────────────
function updatePropsPanel(layer) {
    const panel = document.getElementById('layerPropsPanel');
    const fileGroup = document.getElementById('propFileGroup');
    const fileDrop = document.getElementById('propFileDrop');
    const fileLoaded = document.getElementById('propFileLoaded');
    const fileIcon = document.getElementById('propFileIcon');
    const fileName = document.getElementById('propFileName');
    const textoGroup = document.getElementById('propTextoGroup');
    const propTitle = document.getElementById('propTitle');
    if (!layer) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    propTitle.textContent = `${TYPE_ICONS[layer.type]} ${layer.type.toUpperCase()}`;
    const isTexto = layer.type === 'texto';
    fileGroup.style.display = isTexto ? 'none' : 'block';
    textoGroup.style.display = isTexto ? 'block' : 'none';
    if (!isTexto) {
        if (layer.file) {
            fileDrop.style.display = 'none';
            fileLoaded.style.display = 'flex';
            fileIcon.textContent = TYPE_ICONS[layer.type];
            fileName.textContent = layer.file.name;
        }
        else {
            fileDrop.style.display = 'block';
            fileLoaded.style.display = 'none';
        }
    }
    if (isTexto) {
        const ta = document.getElementById('propTexto');
        ta.value = layer.texto || '';
        const colorEl = document.getElementById('propColorTexto');
        if (colorEl)
            colorEl.value = layer.colorTexto || '#ffffff';
        const tamEl = document.getElementById('propTamanoTexto');
        if (tamEl)
            tamEl.value = (layer.tamanoTexto ?? 0.5).toString();
        const fontEl = document.getElementById('propFontTexto');
        if (fontEl)
            fontEl.value = layer.fontTexto || 'roboto';
    }
    // Sliders
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el)
            el.value = val.toString();
    };
    set('propScale', layer.scale);
    set('propOpacity', layer.opacity * 100);
    set('propPosX', parseFloat(layer.posX.toFixed(2)));
    set('propPosY', parseFloat(layer.posY.toFixed(2)));
    set('propPosZ', layer.posZ);
    set('propRotX', Math.round(layer.rotX ?? 0));
    set('propRotY', Math.round(layer.rotY ?? 0));
    set('propRotZ', Math.round(layer.rotZ ?? 0));
    // Animation buttons + params
    const activeAnim = layer.animation || '';
    document.querySelectorAll('#animButtons .anim-btn').forEach(btn => {
        const anim = btn.getAttribute('data-anim') || '';
        btn.classList.toggle('active', anim === activeAnim);
        btn.classList.toggle('full', anim === '' && !activeAnim);
    });
    const animParams = document.getElementById('animParams');
    if (animParams)
        animParams.style.display = activeAnim ? 'block' : 'none';
    const ampRow = document.getElementById('animAmplitudeRow');
    const ampLabel = document.getElementById('animAmplitudeLabel');
    if (ampRow) {
        const showAmp = activeAnim === 'float' || activeAnim === 'rotate';
        ampRow.style.display = showAmp ? 'flex' : 'none';
        if (ampLabel)
            ampLabel.textContent = activeAnim === 'rotate' ? 'Velocidad (ms/vuelta)' : 'Amplitud';
    }
    const axisRow = document.getElementById('animAxisRow');
    if (axisRow) {
        const showAxis = activeAnim === 'float' || activeAnim === 'rotate';
        axisRow.style.display = showAxis ? 'block' : 'none';
        if (showAxis) {
            const currentAxis = layer.animationAxis || 'z';
            document.querySelectorAll('#animAxisRow [data-axis]').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-axis') === currentAxis);
            });
        }
    }
    const set2 = (id, val) => { const el = document.getElementById(id); if (el)
        el.value = val.toString(); };
    set2('propAnimDuration', layer.animationDuration ?? (activeAnim === 'fade' ? 800 : activeAnim === 'scale' ? 600 : activeAnim === 'rotate' ? 6000 : 2000));
    set2('propAnimDelay', layer.animationDelay ?? 0);
    set2('propAnimAmplitude', layer.animationAmplitude ?? (activeAnim === 'rotate' ? 6000 : 0.04));
    // GLB medidas reales
    const glbPanel = document.getElementById('glbMedidasPanel');
    if (glbPanel)
        glbPanel.style.display = layer.type === 'glb' ? 'block' : 'none';
    if (layer.type === 'glb') {
        const anchoEl = document.getElementById('propGlbAncho');
        const altoEl = document.getElementById('propGlbAlto');
        const profEl = document.getElementById('propGlbProf');
        if (anchoEl)
            anchoEl.value = (layer.anchoReal ?? '').toString();
        if (altoEl)
            altoEl.value = (layer.altoReal ?? '').toString();
        if (profEl)
            profEl.value = (layer.profReal ?? '').toString();
        const unidad = layer.unidadReal || 'cm';
        document.querySelectorAll('[data-unidad]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-unidad') === unidad);
        });
    }
    updateSliderValues(layer);
}
function updateSliderValues(layer) {
    const v = (id, text) => {
        const el = document.getElementById(id);
        if (el)
            el.textContent = text;
    };
    v('valScale', `${layer.scale.toFixed(1)}×`);
    v('valOpacity', `${Math.round(layer.opacity * 100)}%`);
    v('valPosX', layer.posX.toFixed(2));
    v('valPosY', layer.posY.toFixed(2));
    v('valPosZ', layer.posZ.toString());
    v('valRotX', `${Math.round(layer.rotX ?? 0)}°`);
    v('valRotY', `${Math.round(layer.rotY ?? 0)}°`);
    v('valRotZ', `${Math.round(layer.rotZ ?? 0)}°`);
    if (layer.type === 'texto') {
        v('valTamanoTexto', `${(layer.tamanoTexto ?? 0.5).toFixed(2)}×`);
    }
    const a = layer.animation || '';
    v('valAnimDuration', `${layer.animationDuration ?? (a === 'fade' ? 800 : a === 'scale' ? 600 : a === 'rotate' ? 6000 : 2000)}ms`);
    v('valAnimDelay', `${layer.animationDelay ?? 0}ms`);
    v('valAnimAmplitude', (layer.animationAmplitude ?? (a === 'rotate' ? 6000 : 0.04)).toString());
}
// ── Layer file upload ────────────────────────────────────────────────────────
function setupLayerFileInput() {
    const fileInput = document.getElementById('layerFileInput');
    const fileDrop = document.getElementById('propFileDrop');
    const btnChange = document.getElementById('btnChangeFile');
    const openPicker = () => {
        const active = layerManager.getActiveLayer();
        if (!active)
            return;
        fileInput.accept = TYPE_ACCEPT[active.type] || '';
        fileInput.click();
    };
    fileDrop.addEventListener('click', openPicker);
    btnChange.addEventListener('click', openPicker);
    // Drag & drop support
    fileDrop.addEventListener('dragover', e => {
        e.preventDefault();
        fileDrop.style.borderColor = 'var(--accent)';
        fileDrop.style.background = 'rgba(230,51,41,0.08)';
    });
    fileDrop.addEventListener('dragleave', () => {
        fileDrop.style.borderColor = '';
        fileDrop.style.background = '';
    });
    fileDrop.addEventListener('drop', e => {
        e.preventDefault();
        fileDrop.style.borderColor = '';
        fileDrop.style.background = '';
        const file = e.dataTransfer?.files[0];
        if (file)
            applyLayerFile(file);
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file)
            applyLayerFile(file);
        fileInput.value = '';
    });
    async function applyLayerFile(file) {
        const active = layerManager.getActiveLayer();
        if (!active)
            return;
        const dims = await detectFileDimensions(file);
        layerManager.updateLayer(active.id, { file, naturalWidth: dims.w, naturalHeight: dims.h });
    }
    function detectFileDimensions(file) {
        return new Promise(resolve => {
            if (file.type.startsWith('image/')) {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
                img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 1, h: 1 }); };
                img.src = url;
            }
            else if (file.type.startsWith('video/')) {
                const vid = document.createElement('video');
                const url = URL.createObjectURL(file);
                vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ w: vid.videoWidth, h: vid.videoHeight }); };
                vid.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 1, h: 1 }); };
                vid.src = url;
            }
            else {
                resolve({ w: 1, h: 1 });
            }
        });
    }
}
// ── Sliders ──────────────────────────────────────────────────────────────────
function setupSliders() {
    const slider = (id, onChange, display, dispId) => {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.addEventListener('input', () => {
            const val = parseFloat(el.value);
            const active = layerManager.getActiveLayer();
            if (!active)
                return;
            const disp = document.getElementById(dispId);
            if (disp)
                disp.textContent = display(val);
            layerManager.updateLayer(active.id, onChange(val));
            // subscriber handles preview update
        });
    };
    slider('propScale', v => ({ scale: v }), v => `${v.toFixed(1)}×`, 'valScale');
    slider('propOpacity', v => ({ opacity: v / 100 }), v => `${Math.round(v)}%`, 'valOpacity');
    slider('propPosX', v => ({ posX: v }), v => v.toFixed(2), 'valPosX');
    slider('propPosY', v => ({ posY: v }), v => v.toFixed(2), 'valPosY');
    slider('propPosZ', v => ({ posZ: v }), v => v.toString(), 'valPosZ');
    slider('propTamanoTexto', v => ({ tamanoTexto: v }), v => `${v.toFixed(2)}×`, 'valTamanoTexto');
    // Rotation number inputs
    const rotInput = (id, field) => {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.addEventListener('input', () => {
            const val = parseFloat(el.value) || 0;
            const active = layerManager.getActiveLayer();
            if (!active)
                return;
            layerManager.updateLayer(active.id, { [field]: val });
        });
    };
    rotInput('propRotX', 'rotX');
    rotInput('propRotY', 'rotY');
    rotInput('propRotZ', 'rotZ');
    const textarea = document.getElementById('propTexto');
    if (textarea) {
        textarea.addEventListener('input', () => {
            const active = layerManager.getActiveLayer();
            if (active)
                layerManager.updateLayer(active.id, { texto: textarea.value });
        });
    }
    const colorPicker = document.getElementById('propColorTexto');
    if (colorPicker) {
        colorPicker.addEventListener('input', () => {
            const active = layerManager.getActiveLayer();
            if (active)
                layerManager.updateLayer(active.id, { colorTexto: colorPicker.value });
        });
    }
    const fontSel = document.getElementById('propFontTexto');
    if (fontSel) {
        fontSel.addEventListener('change', () => {
            const active = layerManager.getActiveLayer();
            if (active)
                layerManager.updateLayer(active.id, { fontTexto: fontSel.value });
        });
    }
    document.getElementById('propGlbAncho')?.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v))
            layerManager.updateLayer(layerManager.getActiveLayer().id, { anchoReal: v });
    });
    document.getElementById('propGlbAlto')?.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v))
            layerManager.updateLayer(layerManager.getActiveLayer().id, { altoReal: v });
    });
    document.getElementById('propGlbProf')?.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v))
            layerManager.updateLayer(layerManager.getActiveLayer().id, { profReal: v });
    });
    document.querySelectorAll('[data-unidad]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-unidad]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const u = btn.getAttribute('data-unidad');
            layerManager.updateLayer(layerManager.getActiveLayer().id, { unidadReal: u });
        });
    });
    // Animation parameter sliders
    const animSlider = (id, field, dispId, fmt) => {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.addEventListener('input', () => {
            const val = parseFloat(el.value);
            const active = layerManager.getActiveLayer();
            if (!active)
                return;
            const disp = document.getElementById(dispId);
            if (disp)
                disp.textContent = fmt(val);
            layerManager.updateLayer(active.id, { [field]: val });
        });
    };
    animSlider('propAnimDuration', 'animationDuration', 'valAnimDuration', v => `${v}ms`);
    animSlider('propAnimDelay', 'animationDelay', 'valAnimDelay', v => `${v}ms`);
    animSlider('propAnimAmplitude', 'animationAmplitude', 'valAnimAmplitude', v => v.toString());
}
// ── Publish ──────────────────────────────────────────────────────────────────
async function shortenUrl(url) {
    try {
        const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
        const data = await res.json();
        return data.shorturl || url;
    }
    catch {
        return url;
    }
}
function setupPublish() {
    const btn = document.getElementById('btnPublish');
    const overlay = document.getElementById('publishOverlay');
    const fill = document.getElementById('pubFill');
    const msg = document.getElementById('pubMsg');
    const result = document.getElementById('pubResult');
    const btnClose = document.getElementById('btnClosePub');
    btnClose.addEventListener('click', () => {
        overlay.classList.remove('show');
        btn.disabled = false;
    });
    btn.addEventListener('click', async () => {
        const nombre = document.getElementById('inputNombre').value.trim();
        if (!nombre) {
            alert('Ingresa un nombre para el proyecto');
            return;
        }
        if (arModo === 'image' && !triggerUploader.getTriggerFile()) {
            alert('Selecciona una imagen trigger');
            return;
        }
        const layers = layerManager.getAllLayers();
        const validLayers = layers.filter(l => l.file || l.type === 'texto');
        if (validLayers.length === 0) {
            alert('Agrega al menos una capa con archivo o texto');
            return;
        }
        btn.disabled = true;
        overlay.classList.add('show');
        fill.style.width = '0%';
        msg.textContent = 'Iniciando...';
        result.innerHTML = '';
        btnClose.style.display = 'none';
        const anchoReal = parseFloat(document.getElementById('inputWidth').value) || 21;
        const altoReal = parseFloat(document.getElementById('inputHeight').value) || 29.7;
        try {
            await publisher.publishProject({
                nombre,
                slug: nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
                modo: arModo,
                trigger: arModo === 'image' ? triggerUploader.getTriggerFile() ?? undefined : undefined,
                triggerW: triggerWidth,
                triggerH: triggerHeight,
                layers,
                anchoReal,
                altoReal
            }, nombre, async (event) => {
                if (event.type === 'progress') {
                    fill.style.width = `${event.percent}%`;
                    msg.textContent = event.message;
                }
                else if (event.type === 'success') {
                    fill.style.width = '100%';
                    msg.textContent = 'Acortando enlace...';
                    const shortUrl = await shortenUrl(event.url);
                    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=f0f0f0&bgcolor=111111&data=${encodeURIComponent(shortUrl)}`;
                    msg.textContent = '¡Publicado!';
                    result.innerHTML = `
            <div style="margin:12px 0 8px;">
              <img src="${qrSrc}" alt="QR" style="border-radius:8px;display:block;margin:0 auto 10px;" width="180" height="180">
            </div>
            <a href="${shortUrl}" target="_blank" style="font-size:13px;font-weight:700;">${shortUrl}</a>
            <div style="font-size:9px;color:#555;margin-top:4px;word-break:break-all;">${event.url}</div>
          `;
                    const slug2 = nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                    trackProject(slug2, nombre, shortUrl);
                    btnClose.style.display = 'block';
                }
                else {
                    msg.textContent = `Error: ${event.message}`;
                    btnClose.style.display = 'block';
                    btn.disabled = false;
                }
            });
        }
        catch {
            btnClose.style.display = 'block';
            btn.disabled = false;
        }
    });
}
// ── Animation buttons ────────────────────────────────────────────────────────
function setupAnimationButtons() {
    document.querySelectorAll('#animButtons .anim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const animVal = btn.getAttribute('data-anim') || '';
            const anim = animVal;
            const active = layerManager.getActiveLayer();
            if (!active)
                return;
            const defDur = animVal === 'fade' ? 800 : animVal === 'scale' ? 600 : animVal === 'rotate' ? 6000 : 2000;
            layerManager.updateLayer(active.id, {
                animation: anim || undefined,
                animationDuration: active.animationDuration ?? defDur
            });
            const axisRow = document.getElementById('animAxisRow');
            if (axisRow)
                axisRow.style.display = (animVal === 'float' || animVal === 'rotate') ? 'block' : 'none';
        });
    });
    document.querySelectorAll('#animAxisRow [data-axis]').forEach(btn => {
        btn.addEventListener('click', () => {
            const axis = btn.getAttribute('data-axis');
            const active = layerManager.getActiveLayer();
            if (!active)
                return;
            layerManager.updateLayer(active.id, { animationAxis: axis });
            document.querySelectorAll('#animAxisRow [data-axis]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}
// ── Projects panel ───────────────────────────────────────────────────────────
function setupProjects() {
    const overlay = document.getElementById('projectsOverlay');
    const list = document.getElementById('projectsList');
    const btnOpen = document.getElementById('btnProjects');
    const btnClose = document.getElementById('btnCloseProjects');
    const render = () => {
        const projects = loadProjects();
        if (projects.length === 0) {
            list.innerHTML = '<div class="projects-empty">No hay proyectos publicados todavía.</div>';
            return;
        }
        list.innerHTML = projects.map(p => `
      <div class="project-item" data-slug="${p.slug}">
        <div>
          <div class="project-item-name">${p.nombre}</div>
          <div class="project-item-date">${new Date(p.publishedAt).toLocaleDateString()}</div>
        </div>
        <a href="${p.url}" target="_blank" class="btn-sm" style="text-decoration:none;">Ver</a>
        <button class="btn-del-project" data-slug="${p.slug}">Borrar</button>
      </div>`).join('');
        list.querySelectorAll('.btn-del-project').forEach(btn => {
            btn.addEventListener('click', async () => {
                const slug = btn.getAttribute('data-slug');
                if (!confirm(`¿Borrar "${slug}"? El link dejará de funcionar.`))
                    return;
                btn.textContent = 'Borrando...';
                btn.disabled = true;
                try {
                    await deleteProject(slug);
                    const stored = JSON.parse(localStorage.getItem('ara_projects') || '[]');
                    localStorage.setItem('ara_projects', JSON.stringify(stored.filter(p => p.slug !== slug)));
                    render();
                }
                catch {
                    alert('Error al borrar el proyecto');
                    btn.disabled = false;
                    btn.textContent = 'Borrar';
                }
            });
        });
    };
    btnOpen.addEventListener('click', () => { render(); overlay.classList.add('show'); });
    btnClose.addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', e => { if (e.target === overlay)
        overlay.classList.remove('show'); });
}
// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // 3D canvas
    const canvasEl = document.getElementById('canvas3d');
    if (canvasEl) {
        preview3D.init(canvasEl);
        // When a layer is moved/rotated via gizmo (TC drag-end or free-drag mouseUp)
        preview3D.onLayerTransformed = (id, update) => {
            layerManager.updateLayer(id, update);
            const active = layerManager.getActiveLayer();
            if (active?.id === id) {
                const setInput = (elId, val, decimals) => {
                    const el = document.getElementById(elId);
                    if (el)
                        el.value = decimals >= 0 ? val.toFixed(decimals) : Math.round(val).toString();
                };
                if (update.posX !== undefined)
                    setInput('propPosX', update.posX, 2);
                if (update.posY !== undefined)
                    setInput('propPosY', update.posY, 2);
                if (update.posZ !== undefined)
                    setInput('propPosZ', update.posZ, 0);
                if (update.rotX !== undefined)
                    setInput('propRotX', update.rotX, -1);
                if (update.rotY !== undefined)
                    setInput('propRotY', update.rotY, -1);
                if (update.rotZ !== undefined)
                    setInput('propRotZ', update.rotZ, -1);
            }
        };
        // When a layer is clicked in the 3D preview, select it in the panel
        preview3D.onLayerSelected = (id) => {
            layerManager.selectLayer(id);
        };
    }
    // Modo AR buttons
    document.getElementById('modoImage')?.addEventListener('click', () => {
        arModo = 'image';
        document.getElementById('modoImage')?.classList.add('active');
        document.getElementById('modoWorld')?.classList.remove('active');
        const ts = document.getElementById('triggerSection');
        if (ts) {
            ts.querySelectorAll('.upload-zone,.trigger-loaded').forEach(el => el.style.display = '');
            document.getElementById('worldModeMsg').style.display = 'none';
        }
    });
    document.getElementById('modoWorld')?.addEventListener('click', () => {
        arModo = 'world';
        document.getElementById('modoWorld')?.classList.add('active');
        document.getElementById('modoImage')?.classList.remove('active');
        const ts = document.getElementById('triggerSection');
        if (ts) {
            ts.querySelectorAll('.upload-zone,.trigger-loaded').forEach(el => el.style.display = 'none');
            document.getElementById('worldModeMsg').style.display = 'block';
        }
    });
    // Trigger
    setupTriggerUpload();
    // Layer type add buttons
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            if (!type)
                return;
            if (layerManager.getAllLayers().length >= 20) {
                alert('Máximo 20 capas');
                return;
            }
            const layer = layerManager.addLayer(type);
            preview3D.addLayer(layer, triggerWidth);
        });
    });
    // Layer manager subscription → render list + update props + sync preview
    layerManager.subscribe((layers, activeId) => {
        renderLayersList(layers, activeId);
        const active = activeId ? layerManager.getLayer(activeId) : undefined;
        updatePropsPanel(active);
        layers.forEach(l => preview3D.updateLayer(l, triggerWidth));
        // Attach/detach TransformControls gizmo to the active layer
        preview3D.selectLayer(activeId ?? null);
    });
    // Layer file input
    setupLayerFileInput();
    // Sliders
    setupSliders();
    // Animation buttons
    setupAnimationButtons();
    // Publish
    setupPublish();
    // Projects
    setupProjects();
});
