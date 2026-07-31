import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { addBackgroundGradient } from 'definedmotion/rendering'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'fractal-tree-growth',
  name: 'Growing Fractal Tree',
  create: fractalTreeGrowthScene
})

const DURATION_MS = 14_000
const LAST_FRAME = 839
const MAX_DEPTH = 6
const CHILDREN_PER_BRANCH = 3
const UP = new THREE.Vector3(0, 1, 0)
const BRANCH_START_COLOR = new THREE.Color('#878787')
const BRANCH_END_COLOR = new THREE.Color('#878787')

interface Branch {
  base: THREE.Vector3
  direction: THREE.Vector3
  end: THREE.Vector3
  length: number
  radius: number
  depth: number
  startFrame: number
  endFrame: number
  key: number
}

interface LeafTip {
  position: THREE.Vector3
  direction: THREE.Vector3
  startFrame: number
  size: number
  key: number
}

interface TreeModel {
  branches: Branch[]
  leaves: LeafTip[]
}

export function fractalTreeGrowthScene(): AnimatedScene {
  return new AnimatedScene(
    1600,
    900,
    SpaceSetting.ThreeDim,
    async (scene) => {
      scene.renderer.shadowMap.enabled = true
      scene.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      scene.renderer.toneMapping = THREE.ACESFilmicToneMapping
      scene.renderer.toneMappingExposure = 1.14
      scene.scene.fog = new THREE.FogExp2('#02040c', 0.014)

      addBackgroundGradient({
        scene,
        topColor: '#111b3c',
        bottomColor: '#02040b',
        lightingIntensity: 0,
        addLighting: false
      })

      const floor = scene.expose(
        'growth-floor',
        new THREE.Mesh(
          new THREE.CircleGeometry(58, 128),
          new THREE.MeshStandardMaterial({
            color: '#07101b',
            roughness: 0.82,
            metalness: 0.22
          })
        ),
        {
          description: 'Dark circular floor from which the fractal tree emerges',
          tags: ['environment', 'floor', 'shadow-receiver']
        }
      )
      floor.rotation.x = -Math.PI / 2
      floor.receiveShadow = true
      scene.add(floor)

      const floorGrid = new THREE.GridHelper(84, 42, '#1d4f67', '#102235')
      floorGrid.position.y = 0.025
      const gridMaterials = Array.isArray(floorGrid.material)
        ? floorGrid.material
        : [floorGrid.material]
      gridMaterials.forEach((material) => {
        material.transparent = true
        material.opacity = 0.26
        material.depthWrite = false
      })
      scene.add(floorGrid)

      const growthRings = [2.2, 4.8, 8.2, 12.5].map((radius, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? '#22d3ee' : '#a78bfa',
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide
        })
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius - 0.035, radius + 0.035, 128),
          material
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.055 + index * 0.004
        scene.add(ring)
        return { ring, material, index }
      })

      const stars = createAtmosphereParticles()
      scene.add(stars)

      const hemisphere = new THREE.HemisphereLight(0x91a7ff, 0x130b08, 1.35)
      const keyLight = new THREE.DirectionalLight(0xffd6a5, 3.1)
      keyLight.position.set(14, 30, 12)
      keyLight.castShadow = true
      keyLight.shadow.mapSize.set(2048, 2048)
      keyLight.shadow.camera.near = 1
      keyLight.shadow.camera.far = 90
      keyLight.shadow.camera.left = -30
      keyLight.shadow.camera.right = 30
      keyLight.shadow.camera.top = 35
      keyLight.shadow.camera.bottom = -15
      keyLight.shadow.bias = -0.00035

      const rimLight = new THREE.SpotLight(0xa855f7, 850, 75, Math.PI / 4.5, 0.65, 1.6)
      rimLight.position.set(-20, 22, -18)
      rimLight.target.position.set(0, 12, 0)

      const rootLight = new THREE.PointLight(0x22d3ee, 0, 26, 1.7)
      rootLight.position.set(0, 1.2, 0)
      scene.add(hemisphere, keyLight, rimLight, rimLight.target, rootLight)

      const model = generateTree()
      const treeGroup = Object.assign(new THREE.Group(), {
        text: `${model.branches.length} recursive branches, ${model.leaves.length} luminous tips`
      })
      treeGroup.name = 'Fractal tree'

      const branchGeometry = new THREE.CylinderGeometry(0.7, 1, 1, 10, 1, false)
      const branchMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        //emissive: '#9ca3af',
        emissiveIntensity: 0.58,
        roughness: 0.62,
        metalness: 0.06,
        vertexColors: true
      })
      const branches = scene.expose(
        'fractal-branches',
        new THREE.InstancedMesh(branchGeometry, branchMaterial, model.branches.length),
        {
          description: 'All recursively generated branches, growing outward by generation',
          tags: ['fractal', 'branches', 'primary-subject', 'dynamic', 'instanced']
        }
      )
      branches.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      branches.castShadow = true
      branches.receiveShadow = true
      model.branches.forEach((branch, index) => {
        const depthMix = branch.depth / MAX_DEPTH
        const color = BRANCH_START_COLOR.clone()
          .lerp(BRANCH_END_COLOR, depthMix)
          .multiplyScalar(0.94 + hash(branch.key + 71) * 0.1)
        branches.setColorAt(index, color)
      })
      if (branches.instanceColor) branches.instanceColor.needsUpdate = true

      const leafGeometry = new THREE.IcosahedronGeometry(1, 0)
      const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        //emissive: '#0891b2',
        emissiveIntensity: 0.62,
        roughness: 0.3,
        metalness: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: 0.92
      })
      const crown = scene.expose(
        'luminous-crown',
        new THREE.InstancedMesh(leafGeometry, leafMaterial, model.leaves.length),
        {
          description: 'Luminous terminal nodes revealing the final recursive generation',
          tags: ['fractal', 'canopy', 'leaves', 'dynamic', 'instanced']
        }
      )
      crown.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      crown.castShadow = true
      model.leaves.forEach((leaf, index) => {
        const color = new THREE.Color('#67e8f9').lerp(
          new THREE.Color('#c084fc'),
          hash(leaf.key + 211)
        )
        crown.setColorAt(index, color)
      })
      if (crown.instanceColor) crown.instanceColor.needsUpdate = true
      treeGroup.add(branches, crown)
      scene.expose('fractal-tree', treeGroup, {
        description: 'Complete growing three-dimensional fractal tree',
        tags: ['fractal', 'tree', 'primary-subject', 'dynamic']
      })
      scene.add(treeGroup)

      const growthState = scene.expose(
        'growth-state',
        Object.assign(new THREE.Group(), {
          text: 'generation 0 of 6; 0 visible branches'
        }),
        {
          description: 'Current recursive generation and visible branch count',
          tags: ['state', 'generation', 'dynamic']
        }
      )
      scene.add(growthState)

      const overviewCamera = scene.exposeCamera(
        'tree-overview',
        new THREE.PerspectiveCamera(50, scene.width / scene.height, 0.1, 180),
        {
          description: 'Stable elevated overview of the complete fractal tree and floor',
          tags: ['overview', 'tree', 'full-structure']
        }
      )
      overviewCamera.position.set(35, 27, 35)
      overviewCamera.lookAt(0, 12, 0)

      const canopyCamera = scene.exposeCamera(
        'canopy',
        new THREE.PerspectiveCamera(52, scene.width / scene.height, 0.1, 130),
        {
          description: 'Close three-quarter view of recursive branching in the crown',
          tags: ['detail', 'canopy', 'branches']
        }
      )
      canopyCamera.position.set(-18, 23, 15)
      canopyCamera.lookAt(0, 17, 0)

      const groundCamera = scene.exposeCamera(
        'ground-up',
        new THREE.PerspectiveCamera(58, scene.width / scene.height, 0.1, 130),
        {
          description: 'Low-angle view emphasizing the tree growing out of the floor',
          tags: ['detail', 'low-angle', 'growth']
        }
      )
      groundCamera.position.set(13, 2.4, 15)
      groundCamera.lookAt(0, 13, 0)

      const branchDummy = new THREE.Object3D()
      const leafDummy = new THREE.Object3D()
      const camera = scene.camera as THREE.PerspectiveCamera
      const cameraPath = createCameraPath()

      const updateFrame = (frame: number): void => {
        let visibleBranches = 0
        let activeGeneration = 0
        model.branches.forEach((branch, index) => {
          const progress = smootherStep(normalized(frame, branch.startFrame, branch.endFrame))
          if (progress > 0.001) {
            visibleBranches++
            activeGeneration = Math.max(activeGeneration, branch.depth)
          }
          const radialGrowth = Math.max(0.001, Math.sqrt(progress))
          branchDummy.position
            .copy(branch.base)
            .addScaledVector(branch.direction, branch.length * progress * 0.5)
          branchDummy.quaternion.setFromUnitVectors(UP, branch.direction)
          branchDummy.scale.set(
            branch.radius * radialGrowth,
            Math.max(0.001, branch.length * progress),
            branch.radius * radialGrowth
          )
          branchDummy.updateMatrix()
          branches.setMatrixAt(index, branchDummy.matrix)
        })
        branches.instanceMatrix.needsUpdate = true
        branches.computeBoundingBox()
        branches.computeBoundingSphere()

        model.leaves.forEach((leaf, index) => {
          const reveal = smootherStep(normalized(frame, leaf.startFrame, leaf.startFrame + 64))
          const breathing = 1 + Math.sin(frame * 0.045 + leaf.key) * 0.055 * reveal
          const scale = Math.max(0.001, leaf.size * reveal * breathing)
          leafDummy.position.copy(leaf.position)
          leafDummy.quaternion.setFromUnitVectors(UP, leaf.direction)
          leafDummy.scale.setScalar(scale)
          leafDummy.updateMatrix()
          crown.setMatrixAt(index, leafDummy.matrix)
        })
        crown.instanceMatrix.needsUpdate = true
        crown.computeBoundingBox()
        crown.computeBoundingSphere()

        const totalGrowth = smootherStep(normalized(frame, 12, 650))
        growthState.text = `generation ${activeGeneration} of ${MAX_DEPTH}; ${visibleBranches} visible branches`
        rootLight.intensity = 2000 + totalGrowth * 235
        leafMaterial.emissiveIntensity = 0.48 + totalGrowth * 0.36
        stars.rotation.y = frame * 0.00032

        growthRings.forEach(({ ring, material, index }) => {
          const local = (((frame / 105 + index * 0.19) % 1) + 1) % 1
          const reveal = smootherStep(normalized(frame, index * 22, index * 22 + 70))
          ring.scale.setScalar(0.92 + local * 0.16)
          material.opacity = (1 - local) ** 2 * 0.25 * reveal
        })

        const cameraProgress = easeInOutSine(normalized(frame, 0, LAST_FRAME))
        camera.position.copy(cameraPath.getPointAt(cameraProgress))
        const targetHeight = THREE.MathUtils.lerp(
          3.2,
          13.5,
          smootherStep(normalized(frame, 40, 620))
        )
        camera.lookAt(0, targetHeight, 0)
        camera.rotateZ(Math.sin(cameraProgress * Math.PI * 2) * 0.018)
        camera.fov = THREE.MathUtils.lerp(52, 45, Math.sin(cameraProgress * Math.PI) ** 2)
        camera.updateProjectionMatrix()
      }

      updateFrame(0)
      scene.onEachTick(updateFrame)
      scene.addAnims(wait((DURATION_MS) / 1000))
    }
  )
}

const generateTree = (): TreeModel => {
  const branches: Branch[] = []
  const leaves: LeafTip[] = []

  const grow = (
    base: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    startFrame: number,
    key: number
  ): void => {
    const duration = 112 - depth * 4
    const endFrame = startFrame + duration
    const end = base.clone().addScaledVector(direction, length)
    branches.push({
      base: base.clone(),
      direction: direction.clone(),
      end,
      length,
      radius,
      depth,
      startFrame,
      endFrame,
      key
    })

    if (depth === MAX_DEPTH) {
      leaves.push({
        position: end,
        direction: direction.clone(),
        startFrame: endFrame - 8 + hash(key + 97) * 18,
        size: 0.13 + hash(key + 131) * 0.16,
        key
      })
      return
    }

    const tangentSeed = Math.abs(direction.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : UP
    const tangent = new THREE.Vector3().crossVectors(direction, tangentSeed).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()

    for (let child = 0; child < CHILDREN_PER_BRANCH; child++) {
      const childKey = key * 5 + child + 1
      const jitter = hash(childKey * 17 + depth * 43)
      const azimuth =
        (child / CHILDREN_PER_BRANCH) * Math.PI * 2 + depth * 1.9416 + (jitter - 0.5) * 0.62
      const bend = THREE.MathUtils.degToRad(24 + depth * 1.5 + jitter * 8)
      const radial = tangent
        .clone()
        .multiplyScalar(Math.cos(azimuth))
        .addScaledVector(bitangent, Math.sin(azimuth))
      const childDirection = direction
        .clone()
        .multiplyScalar(Math.cos(bend))
        .addScaledVector(radial, Math.sin(bend))
      if (childDirection.y < 0.08) childDirection.y = 0.08
      childDirection.normalize()

      grow(
        end,
        childDirection,
        length * (0.69 + hash(childKey + 11) * 0.055),
        radius * 0.68,
        depth + 1,
        startFrame + duration * 0.77 + hash(childKey + 29) * 17,
        childKey
      )
    }
  }

  grow(new THREE.Vector3(0, 0, 0), UP.clone(), 7.8, 0.9, 0, 12, 1)
  return { branches, leaves }
}

const createAtmosphereParticles = (): THREE.Points => {
  const positions = new Float32Array(520 * 3)
  for (let index = 0; index < 520; index++) {
    positions[index * 3] = (hash(index * 3 + 1) - 0.5) * 86
    positions[index * 3 + 1] = 1.5 + hash(index * 3 + 2) * 38
    positions[index * 3 + 2] = (hash(index * 3 + 3) - 0.5) * 86
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#8be9fd',
      size: 0.11,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      sizeAttenuation: true
    })
  )
}

const createCameraPath = (): THREE.CatmullRomCurve3 =>
  new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(15, 4.8, 23),
      new THREE.Vector3(23, 8, 12),
      new THREE.Vector3(19, 12, -17),
      new THREE.Vector3(-4, 16, -27),
      new THREE.Vector3(-24, 19, -5),
      new THREE.Vector3(-14, 22, 23),
      new THREE.Vector3(15, 24, 30),
      new THREE.Vector3(26, 23, 20)
    ],
    false,
    'catmullrom',
    0.36
  )

const hash = (value: number): number => {
  const result = Math.sin(value * 12.9898 + 78.233) * 43758.5453
  return result - Math.floor(result)
}

const normalized = (frame: number, start: number, end: number): number =>
  THREE.MathUtils.clamp((frame - start) / (end - start), 0, 1)

const smootherStep = (value: number): number =>
  value * value * value * (value * (value * 6 - 15) + 10)

const easeInOutSine = (value: number): number => -(Math.cos(Math.PI * value) - 1) / 2
