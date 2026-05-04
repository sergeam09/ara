import * as THREE from 'three'
import { Layer } from '@/types'

export class Gizmos3D {
  private scene: THREE.Scene | null = null
  private gizmoMeshes: Map<string, THREE.Group> = new Map()
  private selectedLayerId: string | null = null
  private onPositionChange: ((id: string, x: number, y: number, z: number) => void) | null = null
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private draggedLayerId: string | null = null
  private dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private dragPoint = new THREE.Vector3()

  init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.scene = scene

    renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e, camera, renderer))
    renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e, camera, renderer))
    renderer.domElement.addEventListener('mouseup', () => this.onMouseUp())
  }

  addGizmo(layer: Layer, position: THREE.Vector3): void {
    if (!this.scene) return

    const group = new THREE.Group()
    group.position.copy(position)

    // Create axis indicators
    const axisLength = 30
    const axisX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), axisLength, 0xff0000, 10, 5)
    const axisY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), axisLength, 0x00ff00, 10, 5)
    const axisZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), axisLength, 0x0000ff, 10, 5)

    group.add(axisX)
    group.add(axisY)
    group.add(axisZ)

    // Create selection sphere
    const sphereGeometry = new THREE.SphereGeometry(15, 8, 8)
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    sphere.userData = { isGizmo: true, layerId: layer.id }
    group.add(sphere)

    group.userData = { layerId: layer.id }
    this.scene.add(group)
    this.gizmoMeshes.set(layer.id, group)
  }

  updateGizmoPosition(layerId: string, position: THREE.Vector3): void {
    const gizmo = this.gizmoMeshes.get(layerId)
    if (gizmo) {
      gizmo.position.copy(position)
    }
  }

  removeGizmo(layerId: string): void {
    const gizmo = this.gizmoMeshes.get(layerId)
    if (gizmo && this.scene) {
      this.scene.remove(gizmo)
    }
    this.gizmoMeshes.delete(layerId)
  }

  selectGizmo(layerId: string): void {
    // Deselect previous
    if (this.selectedLayerId) {
      const prevGizmo = this.gizmoMeshes.get(this.selectedLayerId)
      if (prevGizmo) {
        const sphere = prevGizmo.children.find(c => c instanceof THREE.Mesh && c.userData.isGizmo)
        if (sphere instanceof THREE.Mesh) {
          ;(sphere.material as THREE.MeshBasicMaterial).opacity = 0.3
          ;(sphere.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00)
        }
      }
    }

    // Select new
    this.selectedLayerId = layerId
    const gizmo = this.gizmoMeshes.get(layerId)
    if (gizmo) {
      const sphere = gizmo.children.find(c => c instanceof THREE.Mesh && c.userData.isGizmo)
      if (sphere instanceof THREE.Mesh) {
        ;(sphere.material as THREE.MeshBasicMaterial).opacity = 0.8
        ;(sphere.material as THREE.MeshBasicMaterial).color.setHex(0xff6600)
      }
    }
  }

  clearGizmos(): void {
    this.gizmoMeshes.forEach((gizmo) => {
      if (this.scene) this.scene.remove(gizmo)
    })
    this.gizmoMeshes.clear()
    this.selectedLayerId = null
  }

  setPositionChangeCallback(callback: (id: string, x: number, y: number, z: number) => void): void {
    this.onPositionChange = callback
  }

  private onMouseDown(e: MouseEvent, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1
    this.mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, camera)

    const gizmoMeshes = Array.from(this.gizmoMeshes.values())
    const intersects = this.raycaster.intersectObjects(gizmoMeshes, true)

    if (intersects.length > 0) {
      const intersected = intersects[0].object
      const gizmoGroup = gizmoMeshes.find(g => g.children.includes(intersected as any))
      if (gizmoGroup) {
        this.draggedLayerId = gizmoGroup.userData.layerId
        this.dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 1, 0),
          gizmoGroup.position
        )
      }
    }
  }

  private onMouseMove(e: MouseEvent, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    if (!this.draggedLayerId) return

    this.mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1
    this.mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, camera)
    this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint)

    const gizmo = this.gizmoMeshes.get(this.draggedLayerId)
    if (gizmo) {
      gizmo.position.copy(this.dragPoint)

      if (this.onPositionChange) {
        this.onPositionChange(
          this.draggedLayerId,
          gizmo.position.x / 30,
          gizmo.position.z / 20,
          gizmo.position.y / 100
        )
      }
    }
  }

  private onMouseUp(): void {
    this.draggedLayerId = null
  }
}
