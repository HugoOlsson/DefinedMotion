export type RenderProgressPhase =
  | 'preparing'
  | 'rendering-frames'
  | 'encoding-video'
  | 'complete'

export interface RenderProgress {
  phase: RenderProgressPhase
  message: string
  completed?: number
  total?: number
  percent?: number
  frame?: number
}
