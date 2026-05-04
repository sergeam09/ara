export interface Vector3 {
  x: number
  y: number
  z: number
}

export function createVector3(x: number = 0, y: number = 0, z: number = 0): Vector3 {
  return { x, y, z }
}

export function lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  }
}

export function calculateLayerZ(
  layerPosZ: number,
  triggerWidth: number,
  layerIndex: number,
  baseOffset: number = 0.002
): number {
  const depthOffset = (layerPosZ / triggerWidth)
  const indexOffset = layerIndex * baseOffset
  return -(depthOffset + indexOffset)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizePosition(
  value: number,
  min: number = -1,
  max: number = 1
): number {
  return clamp(value, min, max)
}
