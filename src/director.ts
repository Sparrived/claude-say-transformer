import { gsap } from 'gsap'
import { h, hide, set } from './lib/dom'
import { C } from './lib/colors'
import { STAGE_CY, W } from './layout'
import type { Clawd } from './clawd/clawd'
import type { Bubble } from './ui/bubble'
import type { Terminal, Year } from './ui/terminal'
import type { Sfx } from './ui/sfx'
import { createBanner, hideBanner, revealBanner, type Banner } from './ui/banner'

export interface Chapter {
  id: string
  title: string
  time: number
}

export interface ChapterOptions {
  id: string
  /** 播放器和底栏里显示的章节名 */
  title: string
  year?: Year
  /** 观众在输入框里提的问题 */
  question?: string
  /** 思考动画里的动词（Claude Code 风格） */
  verb?: string
  /** ANSI Shadow 大字 */
  banner?: string
  color?: string
  /** 本章的画面图层，提问结束后显示 */
  layer?: HTMLElement
  /** 大字停留多久后收起；false 表示由场景自己收 */
  bannerHold?: number | false
}

export interface Cast {
  layers: HTMLElement
  clawd: Clawd
  bubble: Bubble
  term: Terminal
  sfx: Sfx
}

/**
 * 导演：维护一根主时间轴和一个“当前时间”游标。
 * 场景脚本按顺序调用 chapter() / say() / beat()，台词和画面就依次排进时间轴。
 */
export class Director {
  readonly tl = gsap.timeline({ paused: true })
  readonly chapters: Chapter[] = []
  /** 关键时刻的标记（名字 → 秒），配乐靠它对准画面：hop / title / paper-title / gpt3 / land */
  readonly cues: Record<string, number> = {}
  /** 时间游标（秒） */
  t = 0
  private bubbleOpen = false

  constructor(readonly cast: Cast) {}

  get clawd() {
    return this.cast.clawd
  }
  get term() {
    return this.cast.term
  }
  get sfx() {
    return this.cast.sfx
  }

  /** 给当前时刻（或指定时刻）起个名字 */
  cue(name: string, t = this.t) {
    this.cues[name] = t
  }

  /** 新建一个场景图层（默认隐藏） */
  layer(id: string) {
    const el = h('div', { class: `scene scene-${id}` })
    this.cast.layers.append(el)
    hide(el)
    return el
  }

  /** 开始新的一章：提问 → 思考 → 大字标题 */
  chapter(o: ChapterOptions): Banner | null {
    this.hush()
    const t0 = this.t
    this.chapters.push({ id: o.id, title: o.title, time: t0 })
    this.tl.addLabel(o.id, t0)
    if (o.year) this.term.year(this.tl, o.year, t0)
    this.term.footer(this.tl, o.title, t0)
    let t = t0 + 0.25
    if (o.question) {
      this.clawd.look(this.tl, 'd', t)
      t = this.term.ask(this.tl, o.question, t)
      this.clawd.look(this.tl, 'u', t)
      t = this.term.think(this.tl, t, 1.0, o.verb)
      this.clawd.look(this.tl, 'c', t)
    }
    if (o.layer) set(this.tl, o.layer, { autoAlpha: 1 }, t)
    let banner: Banner | null = null
    if (o.banner) {
      banner = createBanner(o.banner, { cell: 17, maxWidth: 1560, color: o.color ?? C.clawd })
      banner.el.classList.add('chapter-banner')
      Object.assign(banner.el.style, {
        left: `${(W - banner.width) / 2}px`,
        top: `${STAGE_CY - banner.height / 2 - 24}px`,
      })
      ;(o.layer ?? this.term.root).append(banner.el)
      this.sfx.at(t, 'whoosh')
      const shown = revealBanner(this.tl, banner, t, 0.75)
      if (o.bannerHold !== false) hideBanner(this.tl, banner, shown + (o.bannerHold ?? 1.0))
      t = shown + 0.45
    }
    this.t = t
    return banner
  }

  /**
   * 一句台词。fn(t) 在台词开始的时刻被调用，用来安排同步的画面动画。
   * 返回台词开始时间。
   */
  say(text: string, fn?: (t: number) => void, o: { hold?: number; talk?: boolean; after?: number } = {}) {
    let t = this.t
    if (!this.bubbleOpen) {
      t = this.cast.bubble.open(this.tl, t, this.sfx)
      this.bubbleOpen = true
    }
    const line = this.cast.bubble.line(text)
    this.cast.bubble.play(this.tl, line, t, this.sfx)
    if (o.talk !== false) this.clawd.talk(this.tl, t, line.typeDur)
    fn?.(t)
    const end = t + line.typeDur + (o.hold ?? line.hold)
    set(this.tl, line.el, { autoAlpha: 0 }, end)
    this.t = end + (o.after ?? 0)
    return t
  }

  /** 收起气泡 */
  hush() {
    if (!this.bubbleOpen) return
    this.cast.bubble.close(this.tl, this.t)
    this.bubbleOpen = false
  }

  /** 不说话，只放画面 */
  beat(dur: number, fn?: (t: number) => void) {
    const t = this.t
    fn?.(t)
    this.t += dur
    return t
  }

  /** 场景淡出 */
  end(layer: HTMLElement, dur = 0.5) {
    this.hush()
    this.tl.to(layer, { autoAlpha: 0, duration: dur, ease: 'power1.in' }, this.t)
    this.t += dur * 0.7
  }

  /** 全部场景排完后调用：补上贯穿全片的待机动作 */
  finish() {
    const end = this.t + 0.5
    this.tl.to({}, { duration: 0.01 }, end)
    this.clawd.idle(this.tl, 0, end)
    this.term.blinkCursor(this.tl, 0, end)
    this.sfx.finalize()
    return end
  }
}
