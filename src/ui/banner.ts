import figlet from 'figlet'
import ansiShadow from 'figlet/fonts/ANSI Shadow'
import { gsap } from 'gsap'
import { s, set } from '../lib/dom'
import { C, mix } from '../lib/colors'

// Claude Code 首次启动时那行巨大的 “CLAUDE CODE” 用的就是 figlet 的 ANSI Shadow 字体
figlet.parseFont('ANSI Shadow', ansiShadow)

export interface Banner {
  el: SVGSVGElement
  cols: SVGGElement[]
  scan: SVGRectElement
  width: number
  height: number
  cell: number
}

/**
 * 双线制表符（╔ ═ ╗ ║ ╚ ╝）按终端的做法用矢量线画出来，
 * 相邻字符格首尾相接，不会出现字体渲染造成的缝隙。
 */
function glyph(ch: string, x: number, y: number, cw: number, chh: number, face: string, shade: string) {
  const cx = x + cw / 2
  const cy = y + chh / 2
  const d = cw * 0.2
  const line = (path: string) =>
    s('path', { d: path, fill: 'none', stroke: shade, 'stroke-width': Math.max(1.5, cw * 0.13), 'stroke-linejoin': 'miter' })
  switch (ch) {
    case '█':
      return s('rect', { x, y, width: cw, height: chh, fill: face })
    case '▀':
      return s('rect', { x, y, width: cw, height: chh / 2, fill: face })
    case '▄':
      return s('rect', { x, y: y + chh / 2, width: cw, height: chh / 2, fill: face })
    case '═':
      return line(`M${x},${cy - d}H${x + cw}M${x},${cy + d}H${x + cw}`)
    case '║':
      return line(`M${cx - d},${y}V${y + chh}M${cx + d},${y}V${y + chh}`)
    case '╗':
      return line(`M${x},${cy - d}H${cx + d}V${y + chh}M${x},${cy + d}H${cx - d}V${y + chh}`)
    case '╔':
      return line(`M${x + cw},${cy - d}H${cx - d}V${y + chh}M${x + cw},${cy + d}H${cx + d}V${y + chh}`)
    case '╝':
      return line(`M${x},${cy + d}H${cx + d}V${y}M${x},${cy - d}H${cx - d}V${y}`)
    case '╚':
      return line(`M${x + cw},${cy + d}H${cx - d}V${y}M${x + cw},${cy - d}H${cx + d}V${y}`)
    default:
      return null
  }
}

export function createBanner(
  text: string,
  { cell = 16, maxWidth = Infinity, color = C.clawd }: { cell?: number; maxWidth?: number; color?: string } = {},
): Banner {
  const lines = figlet.textSync(text, { font: 'ANSI Shadow' }).split('\n')
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  const grid = lines.map((l) => [...l])
  const cols = Math.max(...grid.map((r) => r.length))
  const cw = Math.min(cell, Math.floor(maxWidth / cols))
  const chh = cell * 2
  const width = cols * cw
  const height = grid.length * chh
  const shade = mix(color, C.ink, 0.5)

  const colGroups: SVGGElement[] = []
  for (let c = 0; c < cols; c++) {
    const g = s('g')
    grid.forEach((row, r) => {
      const node = glyph(row[c] ?? ' ', c * cw, r * chh, cw, chh, color, shade)
      if (node) g.append(node)
    })
    colGroups.push(g)
  }
  const scan = s('rect', { x: -cw, y: -4, width: cw, height: height + 8, fill: C.fg })
  const el = s(
    'svg',
    { class: 'banner', viewBox: `0 0 ${width} ${height}`, width, height, overflow: 'visible', 'aria-label': text },
    [...colGroups, scan],
  )
  gsap.set(colGroups, { autoAlpha: 0 })
  gsap.set(scan, { autoAlpha: 0 })
  return { el, cols: colGroups, scan, width, height, cell: cw }
}

/** 像打印机一样逐列扫出来，前面带一道亮光 */
export function revealBanner(tl: gsap.core.Timeline, b: Banner, t: number, dur = 0.8) {
  const each = dur / b.cols.length
  b.cols.forEach((g, i) => set(tl, g, { autoAlpha: 1 }, t + i * each))
  set(tl, b.scan, { autoAlpha: 0.9, x: 0 }, t)
  tl.to(b.scan, { x: b.width + b.cell, duration: dur, ease: 'none' }, t)
  set(tl, b.scan, { autoAlpha: 0 }, t + dur)
  return t + dur
}

export function hideBanner(tl: gsap.core.Timeline, b: Banner, t: number, dur = 0.35) {
  const each = dur / b.cols.length
  b.cols.forEach((g, i) => set(tl, g, { autoAlpha: 0 }, t + i * each))
  return t + dur
}
