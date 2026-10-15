/**
 * Clawd —— Claude Code 启动界面里的橙色像素小人。
 *
 * 在终端里，它是用 Unicode “四分块”字符拼出来的（取自 Claude Code 欢迎界面）：
 *
 *      ▐▛███▜▌
 *     ▝▜█████▛▘
 *       ▘▘ ▝▝
 *
 * 每个字符格被切成 2×2 个四分块；终端字符格大约是 1:2 的竖长方形，
 * 所以每个四分块相当于 1 个像素宽、2 个像素高。decodeQuadrants() 按这个规则
 * 把上面的字符画还原成正方形像素点阵，得到 16×10 的精灵图：
 * 12×8 的身体、两只竖长的眼睛、左右各一节短手臂、四条细腿。
 */
export const TERMINAL_ART = [' ▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝']

/** Claude Code 主题里的 “claude” 色：rgb(215,119,87) */
export const CLAWD_ORANGE = '#D77757'
/** 终端里眼睛其实是“镂空”的，露出深色背景 */
export const CLAWD_EYE = '#191817'

// 四分块字符 → [左上, 右上, 左下, 右下]
const QUADRANTS: Record<string, [number, number, number, number]> = {
  ' ': [0, 0, 0, 0],
  '▘': [1, 0, 0, 0],
  '▝': [0, 1, 0, 0],
  '▖': [0, 0, 1, 0],
  '▗': [0, 0, 0, 1],
  '▀': [1, 1, 0, 0],
  '▄': [0, 0, 1, 1],
  '▌': [1, 0, 1, 0],
  '▐': [0, 1, 0, 1],
  '▚': [1, 0, 0, 1],
  '▞': [0, 1, 1, 0],
  '▛': [1, 1, 1, 0],
  '▜': [1, 1, 0, 1],
  '▙': [1, 0, 1, 1],
  '▟': [0, 1, 1, 1],
  '█': [1, 1, 1, 1],
}

/** 把四分块字符画解码成正方形像素点阵（'#' 为实心，'.' 为空），并裁掉四周空白 */
export function decodeQuadrants(lines: string[]): string[] {
  const cols = Math.max(...lines.map((l) => [...l].length)) * 2
  const quad: number[][] = []
  lines.forEach((line, r) => {
    quad[2 * r] = new Array(cols).fill(0)
    quad[2 * r + 1] = new Array(cols).fill(0)
    ;[...line].forEach((ch, i) => {
      const q = QUADRANTS[ch] ?? QUADRANTS['█']
      quad[2 * r][2 * i] = q[0]
      quad[2 * r][2 * i + 1] = q[1]
      quad[2 * r + 1][2 * i] = q[2]
      quad[2 * r + 1][2 * i + 1] = q[3]
    })
  })
  // 四分块是 1:2 的竖长方形 → 每一行展开成两行正方形像素
  const square = quad.flatMap((row) => [row, row])
  const used = (row: number[]) => row.some(Boolean)
  const top = square.findIndex(used)
  const bottom = square.length - 1 - [...square].reverse().findIndex(used)
  const colUsed = (c: number) => square.some((row) => row[c])
  let left = 0
  while (!colUsed(left)) left++
  let right = cols - 1
  while (!colUsed(right)) right--
  return square.slice(top, bottom + 1).map((row) =>
    row
      .slice(left, right + 1)
      .map((v) => (v ? '#' : '.'))
      .join(''),
  )
}

export const SPRITE = decodeQuadrants(TERMINAL_ART)
export const SPRITE_W = SPRITE[0].length // 16
export const SPRITE_H = SPRITE.length // 10

// 下面是从点阵里拆出来的部件坐标（单位：精灵像素），用于分别做动画
export const PARTS = {
  body: { x: 2, y: 0, w: 12, h: 8 },
  armL: { x: 0, y: 4, w: 2, h: 2 },
  armR: { x: 14, y: 4, w: 2, h: 2 },
  /** 两组交替迈步的腿：每侧各取一条 */
  legsA: [3, 10],
  legsB: [5, 12],
  legY: 8,
  legH: 2,
  /** 眼睛所在的列 */
  eyes: [4, 11],
  eyeY: 2,
  eyeH: 2,
} as const
