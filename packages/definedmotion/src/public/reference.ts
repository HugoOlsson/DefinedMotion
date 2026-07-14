export interface DefinedMotionReferenceEntry {
  id: string
  name: string
  kind: 'example' | 'test'
  source: string
}

export const referenceRoot = 'reference'
