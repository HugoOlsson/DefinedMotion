import * as THREE from 'three'
import { worldBounds } from './measurement'

import { SceneRuntimeError } from './scene/sceneErrors'

export const Axis = {
  X: 'x',
  Y: 'y',
  Z: 'z'
} as const

export type Axis = (typeof Axis)[keyof typeof Axis]

export type PositionGap =
  | number
  | {
      initial: number
      range: readonly [min: number, max: number]
    }

export interface GapPlacementOptions {
  gap: PositionGap
}

export interface CenterWithOptions {
  axis: Axis
}

interface NormalizedGap {
  initial: number
  min: number
  max: number
  ranged: boolean
}

interface ConstraintBase {
  dependent: THREE.Object3D
  reference: THREE.Object3D
  axis: Axis
  oneShot: boolean
}

interface GapConstraint extends ConstraintBase {
  kind: 'gap'
  direction: -1 | 1
  gap: NormalizedGap
  initialized: boolean
}

interface CenterConstraint extends ConstraintBase {
  kind: 'center'
}

type PositionConstraint = GapConstraint | CenterConstraint

type RegisterGap = (
  reference: THREE.Object3D,
  axis: Axis,
  direction: -1 | 1,
  options: GapPlacementOptions
) => void

type RegisterCenter = (reference: THREE.Object3D, axis: unknown) => void

interface BoundsRecord {
  box: THREE.Box3
  frame: number
}

type PositioningErrorCode =
  | 'POSITIONING_INVALID_OBJECT'
  | 'POSITIONING_INVALID_GAP'
  | 'POSITIONING_INVALID_AXIS'
  | 'POSITIONING_SELF_REFERENCE'
  | 'POSITIONING_AXIS_CONFLICT'
  | 'POSITIONING_SUBTREE_CONFLICT'
  | 'POSITIONING_NESTED_DEPENDENTS'
  | 'POSITIONING_MANUAL_MATRIX'
  | 'POSITIONING_CYCLE'
  | 'POSITIONING_INTERNAL_ERROR'

const POSITIONING_EPSILON = 1e-7

const positioningError = (code: PositioningErrorCode, message: string): SceneRuntimeError =>
  new SceneRuntimeError(code, message)

const axisIndex = (axis: Axis): 0 | 1 | 2 => {
  switch (axis) {
    case Axis.X:
      return 0
    case Axis.Y:
      return 1
    case Axis.Z:
      return 2
  }
}

const objectLabel = (object: THREE.Object3D): string =>
  object.name ? `"${object.name}"` : `${object.type}#${object.id}`

function assertObject3D(
  value: unknown,
  role: 'dependent' | 'reference'
): asserts value is THREE.Object3D {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('isObject3D' in value) ||
    !value.isObject3D
  ) {
    throw positioningError(
      'POSITIONING_INVALID_OBJECT',
      `Positioning ${role} must be a Three.js Object3D`
    )
  }
}

const isAncestorOf = (possibleAncestor: THREE.Object3D, object: THREE.Object3D): boolean => {
  let parent = object.parent
  while (parent) {
    if (parent === possibleAncestor) return true
    parent = parent.parent
  }
  return false
}

const normalizeGap = (gap: unknown): NormalizedGap => {
  if (typeof gap === 'number') {
    if (!Number.isFinite(gap)) {
      throw positioningError(
        'POSITIONING_INVALID_GAP',
        `Position gap must be finite, received ${gap}`
      )
    }
    return { initial: gap, min: gap, max: gap, ranged: false }
  }

  if (typeof gap !== 'object' || gap === null || !('initial' in gap) || !('range' in gap)) {
    throw positioningError(
      'POSITIONING_INVALID_GAP',
      'Position gap must be a finite number or { initial, range: [min, max] }'
    )
  }

  const { initial, range } = gap
  if (!Array.isArray(range) || range.length !== 2) {
    throw positioningError(
      'POSITIONING_INVALID_GAP',
      'Position gap range must contain exactly [min, max]'
    )
  }

  const min = range[0]
  const max = range[1]

  if (![initial, min, max].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw positioningError(
      'POSITIONING_INVALID_GAP',
      'Position gap initial, minimum, and maximum must be finite numbers'
    )
  }
  const normalizedInitial = initial as number
  const normalizedMin = min as number
  const normalizedMax = max as number
  if (normalizedMin > normalizedMax) {
    throw positioningError(
      'POSITIONING_INVALID_GAP',
      `Position gap range must be ordered, received [${normalizedMin}, ${normalizedMax}]`
    )
  }
  if (normalizedInitial < normalizedMin || normalizedInitial > normalizedMax) {
    throw positioningError(
      'POSITIONING_INVALID_GAP',
      `Position gap initial value ${initial} must be inside [${min}, ${max}]`
    )
  }

  return { initial: normalizedInitial, min: normalizedMin, max: normalizedMax, ranged: true }
}

/** Public, fluent surface returned by `Positioning.place()` and `Positioning.placeOnce()`. */
export interface PositionBuilder {
  rightOf(reference: THREE.Object3D, options: GapPlacementOptions): this
  leftOf(reference: THREE.Object3D, options: GapPlacementOptions): this
  above(reference: THREE.Object3D, options: GapPlacementOptions): this
  below(reference: THREE.Object3D, options: GapPlacementOptions): this
  positiveZOf(reference: THREE.Object3D, options: GapPlacementOptions): this
  negativeZOf(reference: THREE.Object3D, options: GapPlacementOptions): this
  centerWith(reference: THREE.Object3D, options: CenterWithOptions): this
}

/**
 * Public positioning surface. The object passed to `place()` or `placeOnce()`
 * is always the object that positioning constraints are allowed to move.
 */
export interface Positioning {
  /** Registers relationships that are solved on every scene tick. */
  place(object: THREE.Object3D): PositionBuilder
  /** Registers relationships that are removed after their first successful solve. */
  placeOnce(object: THREE.Object3D): PositionBuilder
}

class PositionBuilderImpl implements PositionBuilder {
  constructor(
    private readonly registerGap: RegisterGap,
    private readonly registerCenter: RegisterCenter
  ) {}

  rightOf(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.X, 1, options)
    return this
  }

  leftOf(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.X, -1, options)
    return this
  }

  above(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.Y, 1, options)
    return this
  }

  below(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.Y, -1, options)
    return this
  }

  positiveZOf(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.Z, 1, options)
    return this
  }

  negativeZOf(reference: THREE.Object3D, options: GapPlacementOptions): this {
    this.registerGap(reference, Axis.Z, -1, options)
    return this
  }

  centerWith(reference: THREE.Object3D, options: CenterWithOptions): this {
    this.registerCenter(reference, options?.axis)
    return this
  }
}

/**
 * One-way, bounds-based positioning graph. Every relationship measures a
 * reference object and moves only the object supplied to `place()`.
 */
export class PositioningSystem implements Positioning {
  private constraints: PositionConstraint[] = []
  private nodes = new Set<THREE.Object3D>()
  private boundsRecords = new Map<THREE.Object3D, BoundsRecord>()
  private solveOrder: PositionConstraint[] = []
  private graphDirty = false
  private frame = 0

  private readonly translation = new THREE.Vector3()
  private readonly worldPosition = new THREE.Vector3()

  place(object: THREE.Object3D): PositionBuilder {
    return this.createBuilder(object, false)
  }

  placeOnce(object: THREE.Object3D): PositionBuilder {
    return this.createBuilder(object, true)
  }

  private createBuilder(object: THREE.Object3D, oneShot: boolean): PositionBuilder {
    assertObject3D(object, 'dependent')
    return new PositionBuilderImpl(
      (reference, axis, direction, options) =>
        this.registerGap(object, reference, axis, direction, options, oneShot),
      (reference, axis) => this.registerCenter(object, reference, axis, oneShot)
    )
  }

  private registerGap(
    dependent: THREE.Object3D,
    reference: THREE.Object3D,
    axis: Axis,
    direction: -1 | 1,
    options: GapPlacementOptions,
    oneShot: boolean
  ): void {
    assertObject3D(reference, 'reference')
    this.registerConstraint({
      kind: 'gap',
      dependent,
      reference,
      axis,
      direction,
      gap: normalizeGap(options?.gap),
      initialized: false,
      oneShot
    })
  }

  private registerCenter(
    dependent: THREE.Object3D,
    reference: THREE.Object3D,
    axis: unknown,
    oneShot: boolean
  ): void {
    assertObject3D(reference, 'reference')
    if (!Object.values(Axis).includes(axis as Axis)) {
      throw positioningError(
        'POSITIONING_INVALID_AXIS',
        `Invalid positioning axis: ${String(axis)}`
      )
    }
    this.registerConstraint({ kind: 'center', dependent, reference, axis: axis as Axis, oneShot })
  }

  compile(): void {
    if (!this.graphDirty) return

    this.validateDependentHierarchy()

    const adjacency = new Map<THREE.Object3D, Set<THREE.Object3D>>()
    const indegree = new Map<THREE.Object3D, number>()
    const constraintsByDependent = new Map<THREE.Object3D, PositionConstraint[]>()
    const controlledAxes = new Map<THREE.Object3D, Map<Axis, PositionConstraint>>()

    for (const node of this.nodes) {
      adjacency.set(node, new Set())
      indegree.set(node, 0)
    }

    for (const constraint of this.constraints) {
      this.validateRelationship(constraint)

      const existingAxisConstraint = controlledAxes.get(constraint.dependent)?.get(constraint.axis)
      if (existingAxisConstraint) {
        throw positioningError(
          'POSITIONING_AXIS_CONFLICT',
          `${objectLabel(constraint.dependent)} has more than one positioning constraint on ` +
            `the ${constraint.axis.toUpperCase()} axis`
        )
      }

      let dependentAxes = controlledAxes.get(constraint.dependent)
      if (!dependentAxes) {
        dependentAxes = new Map()
        controlledAxes.set(constraint.dependent, dependentAxes)
      }
      dependentAxes.set(constraint.axis, constraint)

      let dependentConstraints = constraintsByDependent.get(constraint.dependent)
      if (!dependentConstraints) {
        dependentConstraints = []
        constraintsByDependent.set(constraint.dependent, dependentConstraints)
      }
      dependentConstraints.push(constraint)

      const outgoing = adjacency.get(constraint.reference)!
      if (!outgoing.has(constraint.dependent)) {
        outgoing.add(constraint.dependent)
        indegree.set(constraint.dependent, indegree.get(constraint.dependent)! + 1)
      }
    }

    const queue: THREE.Object3D[] = []
    for (const node of this.nodes) {
      if (indegree.get(node) === 0) queue.push(node)
    }

    const topologicalNodes: THREE.Object3D[] = []
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index]
      topologicalNodes.push(node)
      for (const dependent of adjacency.get(node)!) {
        const nextIndegree = indegree.get(dependent)! - 1
        indegree.set(dependent, nextIndegree)
        if (nextIndegree === 0) queue.push(dependent)
      }
    }

    if (topologicalNodes.length !== this.nodes.size) {
      const cycle = this.findCycle(adjacency)
      const description = cycle.map(objectLabel).join(' -> ')
      throw positioningError(
        'POSITIONING_CYCLE',
        `Positioning relationships contain a cycle: ${description}`
      )
    }

    this.solveOrder = topologicalNodes.flatMap((node) => constraintsByDependent.get(node) ?? [])
    this.graphDirty = false
  }

  solve(scene: THREE.Scene): void {
    this.compile()
    if (this.solveOrder.length === 0) return

    this.frame++
    scene.updateMatrixWorld(true)

    const completedOneShot: PositionConstraint[] = []
    for (const constraint of this.solveOrder) {
      this.validateMovableDependent(constraint.dependent)
      const applied =
        constraint.kind === 'gap' ? this.solveGap(constraint) : this.solveCenter(constraint)
      if (applied && constraint.oneShot) completedOneShot.push(constraint)
    }
    if (completedOneShot.length > 0) this.removeConstraints(completedOneShot)
  }

  reset(): void {
    this.constraints = []
    this.nodes.clear()
    this.boundsRecords.clear()
    this.solveOrder = []
    this.graphDirty = false
    this.frame = 0
  }

  private registerConstraint(constraint: PositionConstraint): void {
    if (constraint.dependent === constraint.reference) {
      throw positioningError(
        'POSITIONING_SELF_REFERENCE',
        'An object cannot be positioned relative to itself'
      )
    }

    this.constraints.push(constraint)
    this.registerNode(constraint.reference)
    this.registerNode(constraint.dependent)
    this.graphDirty = true
  }

  private registerNode(object: THREE.Object3D): void {
    this.nodes.add(object)
    if (!this.boundsRecords.has(object)) {
      this.boundsRecords.set(object, { box: new THREE.Box3(), frame: -1 })
    }
  }

  private validateRelationship(constraint: PositionConstraint): void {
    const { dependent, reference } = constraint
    this.validateMovableDependent(dependent)

    if (isAncestorOf(reference, dependent) || isAncestorOf(dependent, reference)) {
      throw positioningError(
        'POSITIONING_SUBTREE_CONFLICT',
        `Cannot position ${objectLabel(dependent)} relative to ${objectLabel(reference)} because ` +
          "one is inside the other's Three.js subtree. Use a separate content group as the reference."
      )
    }
  }

  private validateDependentHierarchy(): void {
    const dependents = new Set(this.constraints.map((constraint) => constraint.dependent))

    for (const descendant of dependents) {
      let ancestor = descendant.parent
      while (ancestor) {
        if (dependents.has(ancestor)) {
          throw positioningError(
            'POSITIONING_NESTED_DEPENDENTS',
            `Cannot independently position ${objectLabel(ancestor)} and its descendant ` +
              `${objectLabel(descendant)}. Use sibling groups as positioning dependents instead.`
          )
        }
        ancestor = ancestor.parent
      }
    }
  }

  private validateMovableDependent(dependent: THREE.Object3D): void {
    if (!dependent.matrixAutoUpdate || !dependent.matrixWorldAutoUpdate) {
      throw positioningError(
        'POSITIONING_MANUAL_MATRIX',
        `Cannot position ${objectLabel(dependent)} while matrixAutoUpdate or ` +
          'matrixWorldAutoUpdate is disabled. Positioning dependents must use automatic matrices.'
      )
    }
  }

  private solveGap(constraint: GapConstraint): boolean {
    const dependentBounds = this.getBounds(constraint.dependent)
    const referenceBounds = this.getBounds(constraint.reference)
    if (dependentBounds.isEmpty() || referenceBounds.isEmpty()) return false

    const component = axisIndex(constraint.axis)
    const currentGap =
      constraint.direction === 1
        ? dependentBounds.min.getComponent(component) - referenceBounds.max.getComponent(component)
        : referenceBounds.min.getComponent(component) - dependentBounds.max.getComponent(component)

    let desiredGap: number
    if (!constraint.initialized) {
      desiredGap = constraint.gap.initial
    } else if (constraint.gap.ranged) {
      if (
        currentGap >= constraint.gap.min - POSITIONING_EPSILON &&
        currentGap <= constraint.gap.max + POSITIONING_EPSILON
      ) {
        return true
      }
      desiredGap = THREE.MathUtils.clamp(currentGap, constraint.gap.min, constraint.gap.max)
    } else {
      desiredGap = constraint.gap.initial
    }

    const directionalCorrection = desiredGap - currentGap
    this.applyAxisTranslation(
      constraint.dependent,
      component,
      constraint.direction * directionalCorrection
    )
    constraint.initialized = true
    return true
  }

  private solveCenter(constraint: CenterConstraint): boolean {
    const dependentBounds = this.getBounds(constraint.dependent)
    const referenceBounds = this.getBounds(constraint.reference)
    if (dependentBounds.isEmpty() || referenceBounds.isEmpty()) return false

    const component = axisIndex(constraint.axis)
    const dependentCenter =
      (dependentBounds.min.getComponent(component) + dependentBounds.max.getComponent(component)) /
      2
    const referenceCenter =
      (referenceBounds.min.getComponent(component) + referenceBounds.max.getComponent(component)) /
      2

    this.applyAxisTranslation(constraint.dependent, component, referenceCenter - dependentCenter)
    return true
  }

  private removeConstraints(completed: PositionConstraint[]): void {
    const completedSet = new Set(completed)
    this.constraints = this.constraints.filter((constraint) => !completedSet.has(constraint))
    this.solveOrder = this.solveOrder.filter((constraint) => !completedSet.has(constraint))

    const activeNodes = new Set<THREE.Object3D>()
    for (const constraint of this.constraints) {
      activeNodes.add(constraint.reference)
      activeNodes.add(constraint.dependent)
    }
    this.nodes = activeNodes

    for (const object of this.boundsRecords.keys()) {
      if (!activeNodes.has(object)) this.boundsRecords.delete(object)
    }
  }

  private applyAxisTranslation(object: THREE.Object3D, component: 0 | 1 | 2, amount: number): void {
    if (Math.abs(amount) <= POSITIONING_EPSILON) return

    this.translation.set(0, 0, 0).setComponent(component, amount)
    object.getWorldPosition(this.worldPosition)
    this.worldPosition.add(this.translation)

    if (object.parent) object.parent.worldToLocal(this.worldPosition)
    object.position.copy(this.worldPosition)
    object.updateWorldMatrix(true, true)

    object.traverse((descendant) => {
      const record = this.boundsRecords.get(descendant)
      if (record?.frame === this.frame) record.box.translate(this.translation)
    })

    let ancestor = object.parent
    while (ancestor) {
      const record = this.boundsRecords.get(ancestor)
      if (record?.frame === this.frame) record.frame = -1
      ancestor = ancestor.parent
    }
  }

  private getBounds(object: THREE.Object3D): THREE.Box3 {
    const record = this.boundsRecords.get(object)
    if (!record) {
      throw positioningError(
        'POSITIONING_INTERNAL_ERROR',
        `Missing bounds record for ${objectLabel(object)}`
      )
    }
    if (record.frame !== this.frame) {
      record.box.copy(worldBounds(object))
      record.frame = this.frame
    }
    return record.box
  }

  private findCycle(adjacency: Map<THREE.Object3D, Set<THREE.Object3D>>): THREE.Object3D[] {
    const state = new Map<THREE.Object3D, 0 | 1 | 2>()
    const stack: THREE.Object3D[] = []

    const visit = (node: THREE.Object3D): THREE.Object3D[] | undefined => {
      state.set(node, 1)
      stack.push(node)

      for (const next of adjacency.get(node) ?? []) {
        if (state.get(next) === 1) {
          const start = stack.indexOf(next)
          return [...stack.slice(start), next]
        }
        if ((state.get(next) ?? 0) === 0) {
          const cycle = visit(next)
          if (cycle) return cycle
        }
      }

      stack.pop()
      state.set(node, 2)
      return undefined
    }

    for (const node of this.nodes) {
      if ((state.get(node) ?? 0) !== 0) continue
      const cycle = visit(node)
      if (cycle) return cycle
    }

    return []
  }
}
