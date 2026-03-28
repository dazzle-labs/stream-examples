import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import type { VRMAnimation } from '@pixiv/three-vrm-animation'

export async function loadVrm(url: string): Promise<VRM> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  const gltf = await loader.loadAsync(url)

  // Strip unused geometry before VRM creation
  VRMUtils.removeUnnecessaryVertices(gltf.scene)

  const vrm: VRM | undefined = gltf.userData['vrm']

  if (!vrm) {
    throw new Error('Failed to load VRM from GLTF: no VRM data found in userData')
  }

  // Batch bone transforms for better performance
  VRMUtils.combineSkeletons(gltf.scene)

  // Disable frustum culling on all meshes so the model is always rendered
  vrm.scene.traverse((obj) => {
    obj.frustumCulled = false
  })

  // Rotate VRM 0.x models to face the camera (they face +Z by default)
  VRMUtils.rotateVRM0(vrm)

  return vrm
}

export async function loadIdleAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip | null> {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

  const gltf = await loader.loadAsync(url)
  const animations: VRMAnimation[] | undefined = gltf.userData['vrmAnimations']

  if (!animations || animations.length === 0) {
    console.warn('No VRM animations found in .vrma file')
    return null
  }

  const firstAnimation = animations[0]
  if (!firstAnimation) return null

  const clip = createVRMAnimationClip(firstAnimation, vrm)

  // Re-anchor root position to prevent model from drifting
  const hipNode = vrm.humanoid.getNormalizedBoneNode('hips')
  if (hipNode) {
    hipNode.updateMatrixWorld(true)
    const defaultHipPos = new THREE.Vector3()
    hipNode.getWorldPosition(defaultHipPos)

    const hipsTrack = clip.tracks.find(
      (track) => track instanceof THREE.VectorKeyframeTrack && track.name === `${hipNode.name}.position`,
    )

    if (hipsTrack instanceof THREE.VectorKeyframeTrack && hipsTrack.values.length >= 3) {
      const firstX = hipsTrack.values[0] ?? 0
      const firstY = hipsTrack.values[1] ?? 0
      const firstZ = hipsTrack.values[2] ?? 0
      const dx = firstX - defaultHipPos.x
      const dy = firstY - defaultHipPos.y
      const dz = firstZ - defaultHipPos.z

      for (const track of clip.tracks) {
        if (track.name.endsWith('.position') && track instanceof THREE.VectorKeyframeTrack) {
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = (track.values[i] ?? 0) - dx
            track.values[i + 1] = (track.values[i + 1] ?? 0) - dy
            track.values[i + 2] = (track.values[i + 2] ?? 0) - dz
          }
        }
      }
    }
  }

  return clip
}

export function getModelBounds(vrm: VRM): { center: THREE.Vector3, size: THREE.Vector3 } {
  const box = new THREE.Box3().setFromObject(vrm.scene)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)
  return { center, size }
}
