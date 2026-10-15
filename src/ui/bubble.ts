import { gsap } from 'gsap'
import { h, s, set, hide } from '../lib/dom'
import { BUBBLE } from '../layout'
import { C } from '../lib/colors'
import type { Sfx } from './sfx'

/** 全局语速系数：>1 变慢，<1 变快 */
export const TEMPO = 1

export interface Line {
  el: HTMLParagraphElement
  chars: HTMLSpanElement[]
  /** 每个字出现的相对时间 */
  times: number[]
  typeDur: number
  hold: number
}

const PAUSE_AFTER = /[，。！？：；…）]/
const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9 .'’+\-×/%]*[A-Za-z0-9%])?/g

/**
 * 把一句带简单标记的台词拆成逐字的 <span>。
 *   {q:Query}   用 Query 色
 *   {k:Key} {v:Value} {o:小猫}(橙) {d:注释}(灰)
 * 连续的英文 / 数字会自动换成等宽字体。
 */
export function typeset(markup: string, into: HTMLElement) {
  const chars: HTMLSpanElement[] = []
  const pushText = (text: string, parent: HTMLElement) => {
    let last = 0
    const runs = [...text.matchAll(LATIN_RUN)]
    const emit = (str: string, latin: boolean) => {
      if (!str) return
      const wrap = latin ? h('span', { class: 'lat' }) : parent
      for (const c of str) {
        const span = h('span', { class: 'ch', text: c })
        chars.push(span)
        wrap.append(span)
      }
      if (latin) parent.append(wrap)
    }
    for (const m of runs) {
      emit(text.slice(last, m.index), false)
      emit(m[0], true)
      last = m.index! + m[0].length
    }
    emit(text.slice(last), false)
  }
  const re = /\{(\w+):([^}]*)\}/g
  let last = 0
  for (const m of markup.matchAll(re)) {
    pushText(markup.slice(last, m.index), into)
    const seg = h('span', { class: `seg seg-${m[1]}` })
    into.append(seg)
    pushText(m[2], seg)
    last = m.index! + m[0].length
  }
  pushText(markup.slice(last), into)
  return chars
}

/** 打字节奏：中文字稍慢，英文字母快，标点后停顿一下，像在说话 */
export function typingTimes(chars: HTMLElement[], speed = 1) {
  const times: number[] = []
  let t = 0
  for (const c of chars) {
    times.push(t)
    const ch = c.textContent ?? ''
    if (/[一-鿿]/.test(ch)) t += 0.052
    else if (ch === ' ') t += 0.02
    else if (/[A-Za-z0-9]/.test(ch)) t += 0.03
    else t += 0.04
    if (PAUSE_AFTER.test(ch)) t += 0.14
  }
  return { times: times.map((x) => x * speed * TEMPO), total: t * speed * TEMPO }
}

/** 一行最多容纳的“汉字宽度” */
const LINE_UNITS = 35
const BREAK_AFTER = /[，。：；！？、]/

const charUnits = (c: string) => (/[\x20-\x7e]/.test(c) ? 0.56 : 1)

/**
 * 超过一行的台词，在最靠近中间的标点后面断行，
 * 避免浏览器在词语中间折行（比如把“频率”拆成两半）。
 */
function breakAtPunctuation(chars: HTMLElement[]) {
  const units = chars.map((c) => charUnits(c.textContent ?? ''))
  const total = units.reduce((a, b) => a + b, 0)
  if (total <= LINE_UNITS) return
  let best = -1
  let bestScore = Infinity
  let acc = 0
  chars.forEach((c, i) => {
    acc += units[i]
    if (i === chars.length - 1 || !BREAK_AFTER.test(c.textContent ?? '')) return
    const longer = Math.max(acc, total - acc)
    const score = longer > LINE_UNITS ? 1000 + longer : Math.abs(total - 2 * acc)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  if (best >= 0) chars[best].after(h('br'))
}

/** 阅读量：一个汉字算 1，英文字母算 0.35 */
function readingUnits(text: string) {
  let u = 0
  for (const c of text) {
    if (/[一-鿿]/.test(c)) u += 1
    else if (/[A-Za-z0-9]/.test(c)) u += 0.35
  }
  return u
}

export class Bubble {
  readonly el: HTMLDivElement
  readonly text: HTMLDivElement

  constructor(parent: HTMLElement) {
    this.text = h('div', { class: 'bubble-text' })
    // 像素风的小尾巴，指向左边的 Clawd
    const tail = s('svg', { class: 'bubble-tail', viewBox: '0 0 5 7', width: 30, height: 42, 'shape-rendering': 'crispEdges' }, [
      s('path', { d: 'M5 0H3V1H2V2H1V3H0V4H1V5H2V6H3V7H5Z', fill: C.clawd }),
    ])
    this.el = h('div', { class: 'bubble' }, [tail, this.text])
    Object.assign(this.el.style, {
      left: `${BUBBLE.left}px`,
      top: `${BUBBLE.top}px`,
      width: `${BUBBLE.width}px`,
      height: `${BUBBLE.height}px`,
    })
    parent.append(this.el)
    gsap.set(this.el, { autoAlpha: 0, transformOrigin: '0% 50%' })
  }

  line(markup: string): Line {
    const el = h('p', { class: 'line' })
    const chars = typeset(markup, el)
    breakAtPunctuation(chars)
    this.text.append(el)
    hide(el)
    gsap.set(chars, { visibility: 'hidden' })
    const { times, total } = typingTimes(chars)
    const plain = el.textContent ?? ''
    const hold = Math.min(3.8, Math.max(1.5, 1.1 + readingUnits(plain) * 0.085)) * TEMPO
    return { el, chars, times, typeDur: total, hold }
  }

  /** 逐字显示；同时把“哔哔”音效登记到 sfx 时间表 */
  play(tl: gsap.core.Timeline, line: Line, t: number, sfx?: Sfx) {
    set(tl, line.el, { autoAlpha: 1 }, t)
    line.chars.forEach((c, i) => {
      set(tl, c, { visibility: 'inherit' }, t + line.times[i])
      if (sfx && i % 2 === 0 && /\S/.test(c.textContent ?? '') && !PAUSE_AFTER.test(c.textContent ?? '')) {
        sfx.at(t + line.times[i], 'blip', (c.textContent ?? 'a').charCodeAt(0))
      }
    })
  }

  open(tl: gsap.core.Timeline, t: number, sfx?: Sfx) {
    tl.fromTo(
      this.el,
      { autoAlpha: 0, scale: 0.94 },
      { autoAlpha: 1, scale: 1, duration: 0.24, ease: 'back.out(2.2)', immediateRender: false },
      t,
    )
    sfx?.at(t, 'pop')
    return t + 0.14
  }

  close(tl: gsap.core.Timeline, t: number) {
    tl.to(this.el, { autoAlpha: 0, scale: 0.97, duration: 0.18, ease: 'power1.in' }, t)
    return t + 0.18
  }
}
