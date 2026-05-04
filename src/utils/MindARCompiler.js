import { arrayBufferToBase64 } from './WorkerClient';
let CachedCompiler = null;
async function getCompiler() {
    if (CachedCompiler)
        return CachedCompiler;
    // Dynamic import of CDN URL — bypass TypeScript static analysis
    const dynamicImport = new Function('url', 'return import(url)');
    const mod = await dynamicImport('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
    const Compiler = mod.Compiler || mod.default?.Compiler || window.MINDAR?.IMAGE?.Compiler;
    if (!Compiler) {
        throw new Error('MindAR Compiler not found in module');
    }
    CachedCompiler = Compiler;
    return Compiler;
}
export async function compileTriggerImage(imageFile, onProgress) {
    const Compiler = await getCompiler();
    const img = new Image();
    const objectURL = URL.createObjectURL(imageFile);
    img.src = objectURL;
    return new Promise((resolve, reject) => {
        img.onload = async () => {
            try {
                const compiler = new Compiler();
                await compiler.compileImageTargets([img], (progress) => {
                    onProgress?.({ percent: Math.round(progress * 100) });
                });
                const arrayBuffer = await compiler.exportData();
                URL.revokeObjectURL(objectURL);
                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    throw new Error('Compilation produced empty data');
                }
                resolve(arrayBufferToBase64(arrayBuffer));
            }
            catch (error) {
                URL.revokeObjectURL(objectURL);
                reject(new Error(`Compilation failed: ${error instanceof Error ? error.message : String(error)}`));
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error('Failed to load trigger image for compilation'));
        };
    });
}
