export function createVector3(x = 0, y = 0, z = 0) {
    return { x, y, z };
}
export function lerp(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t
    };
}
export function calculateLayerZ(layerPosZ, triggerWidth, layerIndex, baseOffset = 0.002) {
    const depthOffset = (layerPosZ / triggerWidth);
    const indexOffset = layerIndex * baseOffset;
    return -(depthOffset + indexOffset);
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function normalizePosition(value, min = -1, max = 1) {
    return clamp(value, min, max);
}
