// 舞台固定 1920×1080，所有坐标都以舞台像素为单位，再整体缩放到窗口。
export const W = 1920
export const H = 1080

export const MARGIN = 64

/** 顶部年代标尺 */
export const RULER_Y = 46
/** 已提交的问题（像 Claude Code 对话记录里的 “> 问题”） */
export const HEADING_Y = 92
/** 场景可视区域 */
export const STAGE = { top: 150, bottom: 760, left: MARGIN, right: W - MARGIN } as const
export const STAGE_CX = W / 2
export const STAGE_CY = (STAGE.top + STAGE.bottom) / 2

/** 输入框：Clawd 就站在它的上沿 */
export const PROMPT = { top: 934, height: 66, left: MARGIN, right: W - MARGIN } as const
export const FOOTER_Y = 1016

export const CLAWD_PX = 14
/** Clawd 的“家”：脚底中心坐标 */
export const CLAWD_HOME = { x: 196, y: PROMPT.top } as const

/** 讲解气泡 */
export const BUBBLE = { left: 344, top: 786, width: W - MARGIN - 344, height: 134 } as const
