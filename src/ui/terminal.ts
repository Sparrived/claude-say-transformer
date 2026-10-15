import { gsap } from 'gsap'
import { h, set, at } from '../lib/dom'
import { C } from '../lib/colors'
import { BUBBLE, FOOTER_Y, HEADING_Y, MARGIN, PROMPT, RULER_Y, W } from '../layout'
import { typeset } from './bubble'
import type { Sfx } from './sfx'

type TL = gsap.core.Timeline

export const YEARS = ['1990s', '2014', '2017', '2018', '2020', '2022', '2023', '2026'] as const
export type Year = (typeof YEARS)[number]

// Claude Code 的思考指示器：· ✢ ✳ ✶ ✻ ✽ 来回循环
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽']

/**
 * 终端界面：顶部年代标尺、对话记录里的问题、底部输入框和提示栏。
 * 视觉上对应 Claude Code 的真实界面元素。
 */
export class Terminal {
  readonly root: HTMLDivElement
  readonly prompt: HTMLDivElement
  readonly rulerEl: HTMLDivElement
  readonly footerEl: HTMLDivElement
  private readonly line: HTMLDivElement
  private readonly cursor: HTMLSpanElement
  private readonly placeholder: HTMLSpanElement
  private readonly footRight: HTMLDivElement
  private readonly stopX: number[]
  private readonly stopLabels: HTMLDivElement[]
  private readonly marker: HTMLDivElement
  private readonly fill: HTMLDivElement
  private yearIdx = -1
  private headingCur: HTMLElement | null = null
  private footCur: HTMLElement | null = null

  constructor(
    parent: HTMLElement,
    private readonly sfx: Sfx,
  ) {
    this.root = h('div', { class: 'chrome' })
    parent.append(this.root)

    // ── 年代标尺 ───────────────────────────────
    const x0 = 132
    const x1 = W - 132
    this.stopX = YEARS.map((_, i) => x0 + ((x1 - x0) * i) / (YEARS.length - 1))
    this.rulerEl = h('div', { class: 'ruler' })
    const base = at(h('div', { class: 'ruler-line' }), x0, RULER_Y)
    base.style.width = `${x1 - x0}px`
    this.fill = at(h('div', { class: 'ruler-fill' }), x0, RULER_Y)
    this.fill.style.width = `${x1 - x0}px`
    this.marker = at(h('div', { class: 'ruler-marker' }), 0, RULER_Y)
    this.stopLabels = YEARS.map((y, i) => {
      this.rulerEl.append(at(h('div', { class: 'ruler-tick' }), this.stopX[i], RULER_Y))
      const label = at(h('div', { class: 'ruler-label', text: y }), this.stopX[i], RULER_Y + 12)
      this.rulerEl.append(label)
      return label
    })
    this.rulerEl.prepend(base, this.fill)
    this.rulerEl.append(this.marker)
    gsap.set(this.fill, { scaleX: 0, transformOrigin: '0% 50%' })
    gsap.set(this.marker, { x: this.stopX[0], xPercent: -50, yPercent: -50, autoAlpha: 0 })
    this.root.append(this.rulerEl)

    // ── 输入框 ─────────────────────────────────
    this.cursor = h('span', { class: 'cursor', text: ' ' })
    this.placeholder = h('span', { class: 'placeholder', text: 'Try "讲讲 Transformer 的前世今生"' })
    this.line = h('div', { class: 'prompt-line' }, [h('span', { class: 'gt', text: '>' }), this.cursor, this.placeholder])
    this.prompt = h('div', { class: 'prompt' }, [this.line])
    Object.assign(this.prompt.style, {
      left: `${PROMPT.left}px`,
      top: `${PROMPT.top}px`,
      width: `${PROMPT.right - PROMPT.left}px`,
      height: `${PROMPT.height}px`,
    })
    this.root.append(this.prompt)

    // ── 底部提示栏 ─────────────────────────────
    this.footRight = h('div', { class: 'foot-right' })
    this.footerEl = at(h('div', { class: 'footer' }, [h('span', { text: '? for shortcuts' }), this.footRight]), MARGIN + 22, FOOTER_Y)
    this.footerEl.style.width = `${W - 2 * MARGIN - 44}px`
    this.root.append(this.footerEl)
  }

  /** 光标闪烁：做成贯穿全片的补间，导出视频时也能逐帧复现 */
  blinkCursor(tl: TL, from: number, to: number) {
    const n = Math.max(2, Math.floor((to - from) / 0.53 / 2) * 2)
    tl.to(this.cursor, { opacity: 0, duration: 0.53, ease: 'steps(1)', repeat: n - 1, yoyo: true }, from)
  }

  /** 移动年代标尺 */
  year(tl: TL, y: Year, t: number) {
    const i = YEARS.indexOf(y)
    if (i === this.yearIdx) return t
    const dur = this.yearIdx < 0 ? 0.01 : Math.min(1.4, 0.45 + Math.abs(i - this.yearIdx) * 0.16)
    if (this.yearIdx < 0) set(tl, this.marker, { autoAlpha: 1 }, t)
    tl.to(this.marker, { x: this.stopX[i], duration: dur, ease: 'power2.inOut' }, t)
    tl.to(this.fill, { scaleX: i / (YEARS.length - 1), duration: dur, ease: 'power2.inOut' }, t)
    if (this.yearIdx >= 0) set(tl, this.stopLabels[this.yearIdx], { color: C.faint, fontWeight: 400 }, t)
    set(tl, this.stopLabels[i], { color: C.clawd, fontWeight: 600 }, t + dur * 0.6)
    this.yearIdx = i
    return t + dur
  }

  /** 在输入框里打出问题并回车，问题随即出现在顶部的对话记录里 */
  ask(tl: TL, question: string, t: number) {
    const q = h('span', { class: 'q' })
    const chars = typeset(question, q)
    this.line.insertBefore(q, this.cursor)
    gsap.set(chars, { display: 'none' })
    set(tl, this.placeholder, { display: 'none' }, t)
    let tt = t + 0.15
    chars.forEach((c, i) => {
      set(tl, c, { display: 'inline' }, tt)
      this.sfx.at(tt, 'key', i)
      const ch = c.textContent ?? ''
      tt += /[一-鿿]/.test(ch) ? 0.062 : /[A-Za-z0-9 ]/.test(ch) ? 0.038 : 0.05
    })
    const submit = tt + 0.32
    this.sfx.at(submit, 'enter')
    tl.fromTo(
      this.prompt,
      { borderColor: C.fg },
      { borderColor: 'rgba(136,136,136,0.6)', duration: 0.45, ease: 'power1.out', immediateRender: false },
      submit,
    )
    set(tl, q, { display: 'none' }, submit + 0.04)
    set(tl, this.placeholder, { display: 'inline' }, submit + 0.04)
    this.heading(tl, question, submit + 0.04)
    return submit + 0.12
  }

  /** 顶部的 “> 问题” */
  heading(tl: TL, text: string, t: number) {
    const el = at(h('div', { class: 'heading' }), MARGIN, HEADING_Y)
    el.append(h('span', { class: 'heading-gt', text: '> ' }))
    typeset(text, el)
    this.root.append(el)
    gsap.set(el, { autoAlpha: 0 })
    this.clearHeading(tl, t)
    tl.fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, t)
    this.headingCur = el
    return el
  }

  clearHeading(tl: TL, t: number) {
    if (this.headingCur) tl.to(this.headingCur, { autoAlpha: 0, duration: 0.2 }, t)
    this.headingCur = null
  }

  /** “✻ Pondering… (esc to interrupt)” */
  think(tl: TL, t: number, dur: number, verb = 'Pondering') {
    const glyphs = SPIN.map((g) => h('span', { class: 'spin-glyph', text: g }))
    const spin = h('span', { class: 'spin' }, glyphs)
    const word = h('span', { class: 'think-word', text: `${verb}…` })
    const el = at(h('div', { class: 'thinking' }, [spin, word, h('span', { class: 'think-esc', text: '(esc to interrupt)' })]), BUBBLE.left + 10, BUBBLE.top + 40)
    this.root.append(el)
    gsap.set(el, { autoAlpha: 0 })
    gsap.set(glyphs, { autoAlpha: 0 })
    set(tl, el, { autoAlpha: 1 }, t)
    const frames = [...SPIN.keys(), ...[...SPIN.keys()].reverse()]
    const dt = 0.1
    let prev = -1
    for (let k = 0; k * dt < dur; k++) {
      const gi = frames[k % frames.length]
      if (prev >= 0) set(tl, glyphs[prev], { autoAlpha: 0 }, t + k * dt)
      set(tl, glyphs[gi], { autoAlpha: 1 }, t + k * dt)
      prev = gi
    }
    // 动词上扫过一道高光，和 Claude Code 一样
    tl.fromTo(word, { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: dur, ease: 'none', immediateRender: false }, t)
    set(tl, el, { autoAlpha: 0 }, t + dur)
    return t + dur
  }

  footer(tl: TL, text: string, t: number) {
    const el = h('span', { class: 'foot-title', text })
    this.footRight.append(el)
    gsap.set(el, { autoAlpha: 0 })
    if (this.footCur) set(tl, this.footCur, { autoAlpha: 0 }, t)
    set(tl, el, { autoAlpha: 1 }, t)
    this.footCur = el
  }
}
