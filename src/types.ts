export interface Layer {
  id: string
  type: 'image' | 'video' | 'gif' | 'svg' | 'glb' | 'texto'
  file?: File
  posX: number
  posY: number
  posZ: number
  scale: number
  opacity: number
  animation?: 'fade' | 'scale' | 'float' | 'rotate'
  texto?: string
  colorTexto?: string
  tamanoTexto?: number
  extrusionDepth?: number
  alignTexto?: 'left' | 'center' | 'right'
}

export interface Project {
  nombre: string
  slug: string
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
  modo: 'image'
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
