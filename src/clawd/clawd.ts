import { gsap } from 'gsap'
import { h, s, set, rand } from '../lib/dom'
import { CLAWD_EYE, CLAWD_ORANGE, PARTS, SPRITE_H, SPRITE_W } from './sprite'

export type Expr = 'normal' | 'happy' | 'wide' | 'closed'
export type Prop = 'sweat' | 'bang' | 'ask' | 'heart' | 'note'
export type Look = 'c' | 'l' | 'r' | 'u' | 'd'

type TL = gsap.core.Timeline

// 用 '#' 点阵描述的小道具，坐标原点在精灵左上角（可以是负数，画在头顶上方）
const PROP_ART: Record<Prop, { x: number; y: number; color: string; art: string[] }> = {
  sweat: { x: 14, y: -1, color: '#8FC6EC', art: ['.#', '##', '##'] },
  bang: { x: 7, y: -7, color: '#FFC107', art: ['##', '##', '##', '..', '##'] },
  ask: { x: 6, y: -8, color: '#B1B9F9', art: ['.##.', '#..#', '...#', '..#.', '....', '..#.'] },
  heart: { x: 11, y: -6, color: '#FF6B80', art: ['.#.#.', '#####', '.###.', '..#..'] },
  note: { x: 12, y: -8, color: '#AF87FF', art: ['..#..', '..##.', '..#.#', '..#..', '###..', '###..'] },
}

function pixels(art: string[], ox: number, oy: number, fill: string) {
  const g = s('g', { fill })
  art.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') g.append(s('rect', { x: ox + x, y: oy + y, width: 1, height: 1 }))
    }),
  )
  return g
}

export interface ClawdOptions {
  /** 一个精灵像素对应多少舞台像素 */
  px: number
  /** 初始位置：脚底中心 */
  x: number
  y: number
  scale?: number
}

/**
 * 可以被时间轴驱动的 Clawd。
 *
 * 所有动作方法都是 “在时间 t 往时间轴 tl 里加补间”，并返回动作结束的时间；
 * 位置等状态在构建时按调用顺序记录，所以同一只 Clawd 的动作要按时间先后调用。
 * 动作全部写进同一条时间轴，拖动进度条、逐帧导出视频都能精确还原。
 */
export class Clawd {
  readonly root: HTMLDivElement
  readonly hop: HTMLDivElement
  readonly shadow: HTMLDivElement
  readonly svg: SVGSVGElement
  readonly upper: SVGGElement
  readonly eyes: SVGGElement
  readonly armL: SVGRectElement
  readonly armR: SVGRectElement
  readonly legsA: SVGRectElement[]
  readonly legsB: SVGRectElement[]
  readonly exprs: Record<Expr, SVGGElement>
  readonly props: Record<Prop, SVGGElement>
  readonly px: number

  x: number
  y: number
  scale: number

  constructor(parent: HTMLElement, opts: ClawdOptions) {
    this.px = opts.px
    this.x = opts.x
    this.y = opts.y
    this.scale = opts.scale ?? 1
    const w = SPRITE_W * opts.px
    const hgt = SPRITE_H * opts.px

    const leg = (x: number) =>
      s('rect', { x, y: PARTS.legY, width: 1, height: PARTS.legH, fill: CLAWD_ORANGE })
    this.legsA = PARTS.legsA.map(leg)
    this.legsB = PARTS.legsB.map(leg)

    const b = PARTS.body
    const body = s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: CLAWD_ORANGE })
    const arm = (p: { x: number; y: number; w: number; h: number }) =>
      s('rect', { x: p.x, y: p.y, width: p.w, height: p.h, fill: CLAWD_ORANGE })
    this.armL = arm(PARTS.armL)
    this.armR = arm(PARTS.armR)

    const [e1, e2] = PARTS.eyes
    const eyeGroup = (rects: [number, number, number, number][]) => {
      const g = s('g', { fill: CLAWD_EYE })
      for (const [x, y, ww, hh] of rects) g.append(s('rect', { x, y, width: ww, height: hh }))
      return g
    }
    this.exprs = {
      normal: eyeGroup([
        [e1, PARTS.eyeY, 1, PARTS.eyeH],
        [e2, PARTS.eyeY, 1, PARTS.eyeH],
      ]),
      // ^ ^
      happy: eyeGroup(
        [e1, e2].flatMap((c) => [
          [c - 1, 3, 1, 1],
          [c, 2, 1, 1],
          [c + 1, 3, 1, 1],
        ]) as [number, number, number, number][],
      ),
      // 吃惊：眼睛拉长
      wide: eyeGroup([
        [e1, 1, 1, 3],
        [e2, 1, 1, 3],
      ]),
      // 眯眼 – –
      closed: eyeGroup([
        [e1 - 1, 3, 3, 1],
        [e2 - 1, 3, 3, 1],
      ]),
    }
    this.eyes = s('g', { class: 'clawd-eyes' }, Object.values(this.exprs))
    this.upper = s('g', { class: 'clawd-upper' }, [body, this.armL, this.armR, this.eyes])

    this.props = {} as Record<Prop, SVGGElement>
    for (const [k, p] of Object.entries(PROP_ART) as [Prop, (typeof PROP_ART)[Prop]][]) {
      this.props[k] = pixels(p.art, p.x, p.y, p.color)
    }

    this.svg = s(
      'svg',
      {
        class: 'clawd-svg',
        viewBox: `0 0 ${SPRITE_W} ${SPRITE_H}`,
        width: w,
        height: hgt,
        'shape-rendering': 'crispEdges',
        overflow: 'visible',
        'aria-hidden': 'true',
      },
      [s('g', {}, [...this.legsA, ...this.legsB]), this.upper, s('g', {}, Object.values(this.props))],
    )

    this.shadow = h('div', { class: 'clawd-shadow' })
    this.hop = h('div', { class: 'clawd-hop' }, [this.svg])
    this.root = h('div', { class: 'clawd' }, [this.shadow, this.hop])
    this.root.style.width = `${w}px`
    this.root.style.height = `${hgt}px`
    this.shadow.style.width = `${(PARTS.body.w + 2) * opts.px}px`
    this.shadow.style.height = `${opts.px * 1.1}px`
    parent.append(this.root)

    gsap.set(this.root, { xPercent: -50, yPercent: -100, x: this.x, y: this.y, scale: this.scale, transformOrigin: '50% 100%' })
    gsap.set(this.hop, { transformOrigin: '50% 100%' })
    gsap.set(this.eyes, { svgOrigin: '8 4' })
    for (const [k, g] of Object.entries(this.exprs)) gsap.set(g, { autoAlpha: k === 'normal' ? 1 : 0 })
    for (const g of Object.values(this.props)) gsap.set(g, { autoAlpha: 0 })
  }

  /** 瞬移 */
  place(tl: TL, x: number, y: number, t: number, scale = this.scale) {
    set(tl, this.root, { x, y, scale }, t)
    this.x = x
    this.y = y
    this.scale = scale
    return t
  }

  show(tl: TL, t: number, visible = true) {
    set(tl, this.root, { autoAlpha: visible ? 1 : 0 }, t)
    return t
  }

  /** 迈着小碎步走到 x */
  walkTo(tl: TL, x: number, t: number, speed = 460) {
    const dist = Math.abs(x - this.x)
    if (dist < 1) return t
    const dur = dist / speed
    this.look(tl, x > this.x ? 'r' : 'l', t)
    tl.to(this.root, { x, duration: dur, ease: 'none' }, t)
    this.steps(tl, t, dur)
    this.look(tl, 'c', t + dur)
    this.x = x
    return t + dur
  }

  /** 两组腿交替抬起 */
  steps(tl: TL, t: number, dur: number, step = 0.1) {
    const n = Math.max(2, Math.round(dur / step))
    const dt = dur / n
    for (let i = 0; i < n; i++) {
      set(tl, this.legsA, { attr: { height: i % 2 ? 2 : 1 } }, t + i * dt)
      set(tl, this.legsB, { attr: { height: i % 2 ? 1 : 2 } }, t + i * dt)
    }
    set(tl, [...this.legsA, ...this.legsB], { attr: { height: PARTS.legH } }, t + dur)
  }

  /** 抛物线跳到 (x, y)，可顺便改变大小；带起跳蓄力和落地压扁 */
  hopTo(
    tl: TL,
    x: number,
    y: number,
    t: number,
    { dur = 0.6, height = 120, scale = this.scale }: { dur?: number; height?: number; scale?: number } = {},
  ) {
    const lift = t + 0.12
    tl.to(this.hop, { scaleY: 0.8, scaleX: 1.14, duration: 0.12, ease: 'power2.out' }, t)
    tl.to(this.hop, { scaleY: 1.12, scaleX: 0.92, duration: 0.14, ease: 'power2.out' }, lift)
    tl.to(this.hop, { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'power1.inOut' }, lift + 0.14)
    tl.to(this.root, { x, y, scale, duration: dur, ease: 'power1.inOut' }, lift)
    tl.to(this.hop, { y: -height, duration: dur / 2, ease: 'power2.out' }, lift)
    tl.to(this.hop, { y: 0, duration: dur / 2, ease: 'power2.in' }, lift + dur / 2)
    tl.to(this.shadow, { scale: 0.45, opacity: 0.12, duration: dur / 2, ease: 'power2.out' }, lift)
    tl.to(this.shadow, { scale: 1, opacity: 0.4, duration: dur / 2, ease: 'power2.in' }, lift + dur / 2)
    const land = lift + dur
    tl.to(this.hop, { scaleY: 0.78, scaleX: 1.16, duration: 0.07, ease: 'power1.out' }, land)
    tl.to(this.hop, { scaleY: 1, scaleX: 1, duration: 0.32, ease: 'back.out(3)' }, land + 0.07)
    this.x = x
    this.y = y
    this.scale = scale
    return land + 0.39
  }

  /** 原地蹦一下 */
  bounce(tl: TL, t: number, height = 46) {
    return this.hopTo(tl, this.x, this.y, t, { dur: 0.42, height })
  }

  /** 左右抖动（困惑 / 摇头） */
  shake(tl: TL, t: number) {
    tl.to(this.hop, { x: 6, duration: 0.05, ease: 'steps(1)', repeat: 5, yoyo: true }, t)
    set(tl, this.hop, { x: 0 }, t + 0.32)
    return t + 0.32
  }

  blink(tl: TL, t: number) {
    set(tl, this.eyes, { scaleY: 0.5 }, t)
    set(tl, this.eyes, { scaleY: 1 }, t + 0.12)
    return t + 0.12
  }

  look(tl: TL, dir: Look, t: number) {
    const [x, y] = { c: [0, 0], l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[dir]
    set(tl, this.eyes, { x, y }, t)
    return t
  }

  face(tl: TL, kind: Expr, t: number) {
    for (const [k, g] of Object.entries(this.exprs)) set(tl, g, { autoAlpha: k === kind ? 1 : 0 }, t)
    return t
  }

  /** 头顶冒出小道具（汗滴、感叹号、问号……） */
  prop(tl: TL, kind: Prop, t: number, dur = 1.6) {
    const g = this.props[kind]
    set(tl, g, { autoAlpha: 1, y: 1 }, t)
    set(tl, g, { y: 0 }, t + 0.08)
    if (kind === 'sweat' || kind === 'note') {
      // 慢慢往下滴 / 往上飘
      tl.to(g, { y: kind === 'sweat' ? 2 : -2, duration: dur, ease: 'steps(3)' }, t + 0.1)
    }
    set(tl, g, { autoAlpha: 0, y: 0 }, t + dur)
    return t + dur
  }

  /** 挥手 */
  wave(tl: TL, t: number, cycles = 3) {
    const dt = 0.15
    for (let i = 0; i < cycles * 2; i++) set(tl, this.armR, { y: i % 2 ? -1 : -3 }, t + i * dt)
    const end = t + cycles * 2 * dt
    set(tl, this.armR, { y: 0 }, end)
    return end
  }

  /** 双手举高 */
  cheer(tl: TL, t: number, dur = 1) {
    set(tl, [this.armL, this.armR], { y: -3 }, t)
    set(tl, [this.armL, this.armR], { y: 0 }, t + dur)
    return t + dur
  }

  /** 说话时两只小手交替上下 */
  talk(tl: TL, t: number, dur: number) {
    const dt = 0.15
    const n = Math.floor(dur / dt)
    for (let i = 0; i < n; i++) {
      set(tl, this.armL, { y: i % 2 ? 0 : -1 }, t + i * dt)
      set(tl, this.armR, { y: i % 2 ? -1 : 0 }, t + i * dt)
    }
    set(tl, [this.armL, this.armR], { y: 0 }, t + n * dt)
    return t + n * dt
  }

  /** 贯穿整段时间的待机动作：呼吸起伏 + 随机眨眼 */
  idle(tl: TL, from: number, to: number) {
    const period = 0.62
    const n = Math.max(2, Math.floor((to - from) / period / 2) * 2)
    tl.to(this.upper, { y: 1, duration: period, ease: 'steps(1)', repeat: n - 1, yoyo: true }, from)
    let t = from + 1.4
    let i = 0
    while (t < to) {
      this.blink(tl, t)
      // 偶尔连眨两下
      if (rand(i + 99) > 0.8) this.blink(tl, t + 0.26)
      t += 2.4 + rand(i++) * 2.6
    }
  }
}
