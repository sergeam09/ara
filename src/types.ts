export interface Layer {
  id: string
  type: 'image' | 'video' | 'gif' | 'svg' | 'glb' | 'gltf' | 'model' | 'texto'
  file?: File
  naturalWidth?: number
  naturalHeight?: number
  posX: number
  posY: number
  posZ: number
  scale: number
  opacity: number
  animation?: 'fade' | 'scale' | 'float' | 'rotate'
  animationAxis?: 'x' | 'y' | 'z'
  animationDuration?: number
  animationDelay?: number
  animationAmplitude?: number
  rotX?: number
  rotY?: number
  rotZ?: number
  texto?: string
  colorTexto?: string
  tamanoTexto?: number
  extrusionDepth?: number
  fontTexto?: string
  alignTexto?: 'left' | 'center' | 'right'
  anchoReal?: number
  altoReal?: number
  profReal?: number
  unidadReal?: 'cm' | 'm'
}

export interface Project {
  nombre: string
  slug: string
  modo?: 'image' | 'world'
  trigger?: File
  triggerW?: number
  triggerH?: number
  layers: Layer[]
  anchoReal?: number
  altoReal?: number
  createdAt?: string
  updatedAt?: string
}

export interface GridDimensions {
  width: number
  height: number
  ratio: number
  cellSize: number
}

export interface PublishConfig {
  modo: 'image' | 'world'
  trigger: string
  mind: string
  anchoReal: number
  altoReal: number
  unidad: 'cm'
  capas: Array<{
    id: number
    tipo: string
    archivo: string
    texto?: string
    colorTexto?: string
    tamanoTexto?: number
    extrusionDepth?: number
    font?: string
    animDuration?: number
    animDelay?: number
    animAmplitude?: number
    animationAxis?: 'x' | 'y' | 'z'
    aspectRatio?: number
    rotX?: number
    rotY?: number
    rotZ?: number
    posX: number
    posY: number
    posZ: number
    escala: number
    opacidad: number
    entrada?: string
    delay?: number
    loop?: boolean
  }>
}
