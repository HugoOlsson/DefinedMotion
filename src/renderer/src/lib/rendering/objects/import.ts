import * as THREE from 'three'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Helper function to load an MTL file using a Promise
function loadMTL(mtlPath, mtlFile) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath(mtlPath)
    mtlLoader.load(
      mtlFile,
      (materials) => {
        materials.preload()
        resolve(materials)
      },
      undefined,
      (err) => {
        reject(new Error(`Error loading MTL: ${err}`))
      }
    )
  })
}

// Helper function to load an OBJ file using a Promise
function loadOBJ(objPath, objFile, materials) {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader()
    if (materials) {
      objLoader.setMaterials(materials)
    }
    objLoader.setPath(objPath)
    objLoader.load(
      objFile,
      (object) => {
        resolve(object)
      },
      undefined,
      (err) => {
        reject(new Error(`Error loading OBJ: ${err}`))
      }
    )
  })
}

// Define an interface for the parameters
interface LoadParams {
  mtlPath: string
  mtlFile: string
  objPath: string
  objFile: string
}

// Generic async function that loads an OBJ with its MTL
export async function loadOBJWithMTL({
  mtlPath,
  mtlFile,
  objPath,
  objFile
}: LoadParams): Promise<THREE.Object3D> {
  try {
    // Load the MTL file and get the materials
    const materials = await loadMTL(mtlPath, mtlFile)
    // Load the OBJ file with the preloaded materials
    const object = await loadOBJ(objPath, objFile, materials)
    return object as any
  } catch (error) {
    console.error(error)
    throw error
  }
}

// Generic async function that loads an OBJ with its MTL given full file paths
export async function loadOBJWithMTLPaths(
  objFullPath: string,
  mtlFullPath: string
): Promise<THREE.Object3D> {
  try {
    // Load the MTL file and get the materials
    const materials = await new Promise<any>((resolve, reject) => {
      const mtlLoader = new MTLLoader()
      mtlLoader.load(
        mtlFullPath,
        (materials) => {
          materials.preload()
          resolve(materials)
        },
        undefined,
        (error) => reject(new Error(`Error loading MTL file: ${error}`))
      )
    })

    // Load the OBJ file with the preloaded materials
    const object = await new Promise<THREE.Object3D>((resolve, reject) => {
      const objLoader = new OBJLoader()
      objLoader.setMaterials(materials)
      objLoader.load(
        objFullPath,
        (object) => resolve(object),
        undefined,
        (error) => reject(new Error(`Error loading OBJ file: ${error}`))
      )
    })

    return object
  } catch (error) {
    console.error(error)
    throw error
  }
}

// Generic async function that loads a GLB file given its full path/URL
export async function loadGLB(glbPath: string): Promise<THREE.Object3D> {
  try {
    const gltf: GLTF = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.load(
        glbPath,
        (gltfData) => resolve(gltfData),
        undefined,
        (error) => reject(new Error(`Error loading GLB file: ${error}`))
      )
    })

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // Return the scene (or top-level object) from the GLB file
    return gltf.scene
  } catch (error) {
    console.error(error)
    throw error
  }
}
