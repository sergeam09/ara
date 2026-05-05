export class SceneBuilder {
    buildAFrameScene(config, contentPath) {
        const mindPath = `${contentPath}/trigger.mind`;
        const triggerExt = config.trigger.split('.').pop();
        const triggerPath = `${contentPath}/trigger.${triggerExt}`;
        // Sort layers by posZ DESCENDING: highest posZ (farthest from camera) renders first = stays behind
        const capas = [...config.capas].sort((a, b) => b.posZ - a.posZ);
        // Trigger real width in cm (for scaling GLB to real-world size in image tracking)
        const triggerCm = config.anchoReal || 21;
        let entities = '';
        for (let idx = 0; idx < capas.length; idx++) {
            const capa = capas[idx];
            const layerPath = `${contentPath}/${capa.archivo}`;
            const pos = `${capa.posX} ${capa.posY} ${this.calcZ(idx, capas.length)}`;
            // GLB with real dimensions: scale = (anchoReal / triggerCm) / (anchoRaw / 100)
            // MindAR: 1 A-Frame unit = trigger width. GLTF: 1 unit = 1m = 100cm.
            let sclVal = capa.escala;
            const isGlb = capa.tipo === 'glb' || capa.tipo === 'gltf';
            if (isGlb && capa.anchoReal && capa.anchoRaw && capa.anchoRaw > 0) {
                const toCm = (v) => capa.unidadReal === 'm' ? v * 100 : v;
                sclVal = (toCm(capa.anchoReal) * 100) / (triggerCm * capa.anchoRaw);
            }
            const scl = `${sclVal} ${sclVal} ${sclVal}`;
            const alpha = `transparent:true;alphaTest:0.01;opacity:${capa.opacidad}`;
            if (capa.tipo === 'video') {
                const ext = capa.archivo.split('.').pop()?.toLowerCase() || '';
                const isAlpha = ['webm', 'mov'].includes(ext);
                const mat = isAlpha
                    ? `material="src:${layerPath};${alpha}"`
                    : `material="src:${layerPath};opacity:${capa.opacidad}"`;
                entities += `
        <a-video id="arc-${capa.id}" src="${layerPath}"
          width="1" height="1"
          position="${pos}" scale="${scl}"
          loop="${capa.loop !== false}" playsinline="true" webkit-playsinline="true"
          ${mat}></a-video>`;
            }
            else if (capa.tipo === 'image' || capa.tipo === 'gif' || capa.tipo === 'svg') {
                const ext = capa.archivo.split('.').pop()?.toLowerCase() || '';
                const hasTrans = ['png', 'webp', 'apng', 'gif', 'svg'].includes(ext);
                const mat = `material="src:${layerPath};${hasTrans ? alpha : `opacity:${capa.opacidad}`}"`;
                entities += `
        <a-image id="arc-${capa.id}" src="${layerPath}"
          width="1" height="1"
          position="${pos}" scale="${scl}"
          ${mat}></a-image>`;
            }
            else if (capa.tipo === 'glb' || capa.tipo === 'gltf') {
                entities += `
        <a-gltf-model id="arc-${capa.id}" src="${layerPath}"
          position="${pos}" scale="${scl}"></a-gltf-model>`;
            }
            else if (capa.tipo === 'texto') {
                entities += `
        <a-text id="arc-${capa.id}" value="${capa.archivo || 'Texto AR'}"
          color="#ffffff" align="center"
          position="${pos}" scale="${scl}"></a-text>`;
            }
        }
        return `
    <a-scene
      mindar-image="imageTargetSrc:${mindPath};autoStart:true;uiScanning:false;uiLoading:false;filterMinCF:0.001;filterBeta:0.001;"
      color-space="sRGB" embedded
      renderer="colorManagement:true;physicallyCorrectLights:true;sortObjects:true"
      vr-mode-ui="enabled:false"
      device-orientation-permission-ui="enabled:false"
      style="width:100vw;height:100vh;">

      <a-light type="ambient" intensity="1.2"></a-light>
      <a-light type="directional" intensity="0.8" position="1 3 2"></a-light>
      <a-camera position="0 0 0" look-controls="enabled:false"></a-camera>

      <a-entity id="target" mindar-image-target="targetIndex:0;">
        ${entities}
      </a-entity>
    </a-scene>`;
    }
    // sortedIndex = 0 → renderizado primero = queda detrás (mayor posZ)
    // sortedIndex = n-1 → renderizado último = queda encima (menor posZ, más cerca de cámara)
    // A-Frame: mayor Z = más hacia la cámara
    calcZ(sortedIndex, _total) {
        const z = (sortedIndex * 0.008) + 0.003;
        return z.toFixed(4);
    }
}
