import { ConfigLoader } from './ConfigLoader';
import { SceneBuilder } from './SceneBuilder';
const params = new URLSearchParams(location.search);
const PROJECT = params.get('p');
const EDIT_MODE = params.get('edit') === '1';
const configLoader = new ConfigLoader();
const sceneBuilder = new SceneBuilder();
async function init() {
    if (!PROJECT) {
        showError('No se especificó ningún proyecto');
        return;
    }
    // Load config
    let config = await configLoader.loadConfig(PROJECT);
    if (!config) {
        showError(`No se encontró el proyecto "${PROJECT}"`);
        return;
    }
    // Update start screen
    const startName = document.getElementById('startName');
    if (startName) {
        startName.textContent = PROJECT.replace(/-/g, ' ');
    }
    // Setup publish button listener
    const btnPublish = document.getElementById('btnPublish');
    if (btnPublish) {
        btnPublish.addEventListener('click', () => {
            arrangePresentacion();
        });
    }
}
async function arrangePresentacion() {
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.classList.add('hidden');
    }
    const splash = document.getElementById('splash');
    if (splash) {
        splash.classList.add('visible');
    }
    setSplash('Cargando configuración...');
    let config = await configLoader.loadConfig(PROJECT);
    if (!config) {
        showError('No se pudo cargar la configuración');
        return;
    }
    setSplash('Preparando escena AR...');
    const contentPath = configLoader.getProjectPath(PROJECT);
    // Build A-Frame scene
    const sceneHTML = sceneBuilder.buildAFrameScene(config, contentPath);
    const arScene = document.getElementById('arScene');
    if (arScene) {
        arScene.innerHTML = sceneHTML;
        arScene.classList.add('show');
    }
    // Show HUD
    const hud = document.getElementById('hud');
    if (hud) {
        hud.classList.add('show');
    }
    const scan = document.getElementById('scan');
    if (scan) {
        scan.classList.add('show');
    }
    // Load A-Frame and MindAR scripts if not already loaded
    await loadAFrameScripts();
    setSplash('Iniciando seguimiento...');
    setTimeout(() => {
        hideSplash();
    }, 2000);
}
async function loadAFrameScripts() {
    return new Promise((resolve) => {
        if (typeof window.AFRAME !== 'undefined') {
            resolve(null);
            return;
        }
        const aframeScript = document.createElement('script');
        aframeScript.src = 'https://aframe.io/releases/1.4.2/aframe.min.js';
        aframeScript.onload = () => {
            const mindArScript = document.createElement('script');
            mindArScript.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
            mindArScript.onload = () => resolve(null);
            document.head.appendChild(mindArScript);
        };
        document.head.appendChild(aframeScript);
    });
}
function setSplash(msg) {
    const splashMsg = document.getElementById('smsg');
    if (splashMsg) {
        splashMsg.textContent = msg;
    }
}
function hideSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => {
            splash.classList.remove('visible', 'hidden');
        }, 600);
    }
}
function showError(message) {
    hideSplash();
    const errMsg = document.getElementById('emsg');
    if (errMsg) {
        errMsg.innerHTML = message;
    }
    const errScreen = document.getElementById('errScreen');
    if (errScreen) {
        errScreen.classList.add('show');
    }
}
function cerrarViewer() {
    if (EDIT_MODE) {
        window.location.replace(location.href.replace('&edit=1', '').replace('?edit=1', ''));
        return;
    }
    const arScene = document.getElementById('arScene');
    if (arScene) {
        arScene.classList.remove('show');
        arScene.innerHTML = '';
    }
    const hud = document.getElementById('hud');
    if (hud) {
        hud.classList.remove('show');
    }
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.classList.remove('hidden');
    }
}
// Initialize on load
document.addEventListener('DOMContentLoaded', init);
Object.assign(window, {
    arrancarExperiencia,
    cerrarViewer
});
