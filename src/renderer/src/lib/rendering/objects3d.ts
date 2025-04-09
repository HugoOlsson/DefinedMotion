import * as THREE from 'three'

export function createFunctionSurface(
  func: (a: number, b: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  xSegments: number,
  ySegments: number
) {
  // Create a plane geometry
  const width = xMax - xMin
  const height = yMax - yMin
  const geometry = new THREE.PlaneGeometry(width, height, xSegments, ySegments)

  // Get the vertices and update z values based on the function
  const vertices = geometry.attributes.position

  for (let i = 0; i <= xSegments; i++) {
    for (let j = 0; j <= ySegments; j++) {
      const index = i * (ySegments + 1) + j

      // Map indices to actual x,y coordinates in our desired range
      const x = xMin + (i / xSegments) * width
      const z = yMin + (j / ySegments) * height

      // Set vertex X and Y
      vertices.setX(index, x)
      const y = func(x, z)
      vertices.setY(index, y)

      // Calculate Z using the provided function

      vertices.setZ(index, z)
    }
  }

  // Ensure normals are computed for proper lighting
  geometry.computeVertexNormals()

  // Create mesh with the geometry
  const material = new THREE.MeshPhongMaterial({
    color: 0x156289,
    emissive: 0x072534,
    side: THREE.DoubleSide,
    flatShading: false,
    wireframe: false
  })

  const mesh = new THREE.Mesh(geometry, material)
  return mesh
}

// Function to update an existing function surface with a new time value
export function updateFunctionSurface(
  mesh: THREE.Mesh,
  func: (a: number, b: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  xSegments: number = 200,
  ySegments: number = 200
) {
  const width = xMax - xMin
  const height = yMax - yMin
  const vertices = mesh.geometry.attributes.position

  for (let i = 0; i <= xSegments; i++) {
    for (let j = 0; j <= ySegments; j++) {
      const index = i * (ySegments + 1) + j

      // Map indices to actual x,y coordinates
      const x = xMin + (i / xSegments) * width
      const z = yMin + (j / ySegments) * height

      // Update Y position based on the function with time
      const y = func(x, z)
      vertices.setY(index, y)
    }
  }

  // Mark vertices for update
  vertices.needsUpdate = true

  // Recompute normals for proper lighting
  mesh.geometry.computeVertexNormals()
}

export const createSimpleFunctionSurface = (
  func: (a: number, b: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
) => createFunctionSurface(func, xMin, xMax, yMin, yMax, 200, 200)
