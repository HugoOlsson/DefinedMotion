import * as THREE from 'three'

export const COLORS = {
  red: 0xff0000,
  green: 0x00ff00,
  blue: 0x0000ff,
  white: 0xffffff,
  black: 0x000000,
  yellow: 0xffff00,
  cyan: 0x00ffff,
  magenta: 0xff00ff,
  silver: 0xc0c0c0,
  gray: 0x808080,
  grey: 0x808080,
  orange: 0xffa500,
  pink: 0xffc0cb,
  purple: 0x800080,
  brown: 0xa52a2a,
  gold: 0xffd700,
  indigo: 0x4b0082,
  violet: 0xee82ee,
  maroon: 0x800000,
  teal: 0x008080,
  lime: 0x00ff00,
  olive: 0x808000,
  navy: 0x000080
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const hexColor = (hex: string): THREE.Color => {
  return new THREE.Color(hex)
}
