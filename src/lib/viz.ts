import { gsap } from 'gsap'
import { h, s, set } from './dom'
import { C } from './colors'

type TL = gsap.core.Timeline

/** 铺满舞台的 SVG 画布，用来画连线和箭头 */
export function fx(layer: HTMLElement, { top = false } = {}) {
  const svg = s('svg', { class: 'fx', width: 1920, height: 1080, viewBox: '0 0 1920 1080' })
  if (top) layer.append(svg)
  else layer.prepend(svg)
  return svg
}

/** 词块（token），以中心点定位 */
export function chip(parent: HTMLElement, text: string, x: number, y: number, { w = 0, cls = '' } = {}) {
  const el = h('div', { class: `chip ${cls}`, text })
  Object.assign(el.style, { left: `${x}px`, top: `${y}px` })
  if (w) el.style.minWidth = `${w}px`
  parent.append(el)
  return el
}

/** 方框，以中心点定位 */
export function box(parent: HTMLElement, x: number, y: number, w: number, hh: number, { cls = '', text = '' } = {}) {
  const el = h('div', { class: `box ${cls}`, text })
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` })
  parent.append(el)
  return el
}

/** 文字标签；anchor 决定 (x, y) 指的是左边、中间还是右边 */
export function label(parent: HTMLElement, text: string, x: number, y: number, { cls = '', anchor = 'c' as 'l' | 'c' | 'r' } = {}) {
  const el = h('div', { class: `label anchor-${anchor} ${cls}`, text })
  Object.assign(el.style, { left: `${x}px`, top: `${y}px` })
  parent.append(el)
  return el
}

export interface Arrow {
  path: SVGPathElement
  head: SVGPathElement
}

/** 箭头：直线或二次曲线（bend 为控制点相对中点的垂直偏移） */
export function arrow(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  {
    color = C.dim as string,
    width = 3,
    bend = 0,
    head = 12,
    cls = '',
  }: { color?: string; width?: number; bend?: number; head?: number; cls?: string } = {},
): Arrow {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const nx = -(y2 - y1) / len
  const ny = (x2 - x1) / len
  const cx = mx + nx * bend
  const cy = my + ny * bend
  // 箭头朝向取终点处的切线方向
  const ang = Math.atan2(y2 - cy, x2 - cx)
  // 线条在箭头根部收住，避免线头戳出箭尖
  const ex = x2 - Math.cos(ang) * head * 0.8
  const ey = y2 - Math.sin(ang) * head * 0.8
  const d = bend ? `M${x1},${y1}Q${cx},${cy} ${ex},${ey}` : `M${x1},${y1}L${ex},${ey}`
  const path = s('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', class: cls })
  const hx = (a: number, r: number) => x2 + Math.cos(ang + a) * r
  const hy = (a: number, r: number) => y2 + Math.sin(ang + a) * r
  const headPath = s('path', {
    d: `M${x2},${y2}L${hx(Math.PI * 0.82, head)},${hy(Math.PI * 0.82, head)}L${hx(-Math.PI * 0.82, head)},${hy(-Math.PI * 0.82, head)}Z`,
    fill: color,
    class: cls,
  })
  svg.append(path, headPath)
  gsap.set(path, { drawSVG: '0%' })
  gsap.set(headPath, { autoAlpha: 0 })
  return { path, head: headPath }
}

/** 把箭头“画”出来 */
export function drawArrow(tl: TL, a: Arrow, t: number, dur = 0.35) {
  tl.to(a.path, { drawSVG: '100%', duration: dur, ease: 'power1.inOut' }, t)
  set(tl, a.head, { autoAlpha: 1 }, t + dur * 0.9)
  return t + dur
}

export function hideArrow(tl: TL, a: Arrow, t: number, dur = 0.25) {
  tl.to([a.path, a.head], { autoAlpha: 0, duration: dur }, t)
  return t + dur
}

/** 以中心点淡入 + 轻微放大 */
export function popIn(tl: TL, targets: gsap.TweenTarget, t: number, { stagger = 0.06, dur = 0.35, from = 0.85 } = {}) {
  tl.fromTo(
    targets,
    { autoAlpha: 0, scale: from },
    { autoAlpha: 1, scale: 1, duration: dur, ease: 'back.out(2)', stagger, immediateRender: false },
    t,
  )
}

export function fadeIn(tl: TL, targets: gsap.TweenTarget, t: number, { stagger = 0, dur = 0.4, y = 12 } = {}) {
  tl.fromTo(
    targets,
    { autoAlpha: 0, y },
    { autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', stagger, immediateRender: false },
    t,
  )
}

export function fadeOut(tl: TL, targets: gsap.TweenTarget, t: number, { dur = 0.3, stagger = 0 } = {}) {
  tl.to(targets, { autoAlpha: 0, duration: dur, stagger, ease: 'power1.in' }, t)
}

/** 数字滚动（通过补间 textContent，拖动进度条也能还原） */
export function countTo(
  tl: TL,
  el: HTMLElement,
  to: number,
  t: number,
  { dur = 1, decimals = 0, format }: { dur?: number; decimals?: number; format?: (v: number) => string } = {},
) {
  const fmt = format ?? ((v: number) => v.toFixed(decimals))
  tl.to(el, { textContent: to, duration: dur, ease: 'power1.out', modifiers: { textContent: (v: string | number) => fmt(Number(v)) } }, t)
}

/** 在元素里逐字打出一段文字，返回打完的时间 */
export function typeText(tl: TL, parent: HTMLElement, text: string, t: number, { dt = 0.045 } = {}) {
  const spans = [...text].map((c) => h('span', { text: c }))
  parent.append(...spans)
  gsap.set(spans, { visibility: 'hidden' })
  spans.forEach((sp, i) => set(tl, sp, { visibility: 'inherit' }, t + i * dt))
  return t + spans.length * dt
}

/** 一行词块，按实际宽度排开，整体以 cx 为中心 */
export function chipRow(parent: HTMLElement, words: string[], cx: number, y: number, { gap = 14, cls = '' } = {}) {
  const els = words.map((w) => chip(parent, w, 0, y, { cls }))
  const widths = els.map((e) => e.offsetWidth)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (els.length - 1)
  let x = cx - total / 2
  const xs = els.map((e, i) => {
    const c = x + widths[i] / 2
    e.style.left = `${c}px`
    x += widths[i] + gap
    return c
  })
  return { els, xs, widths }
}
