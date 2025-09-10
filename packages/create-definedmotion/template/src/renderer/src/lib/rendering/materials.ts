import * as THREE from "three"
import { COLORS } from "./helpers"

export const getRegularMetal = (color: number = COLORS.white) => {
  return new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 1 })
}
