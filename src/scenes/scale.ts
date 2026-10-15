import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { countTo, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

const BASE = 700
const MAX_H = 450
const MODELS = [
  { name: 'GPT-1', year: '2018', yi: 1.17, x: 660 },
  { name: 'GPT-2', year: '2019', yi: 15, x: 960 },
  { name: 'GPT-3', year: '2020', yi: 1750, x: 1260 },
]

/** 2019–2020：越做越大 */
export function scale(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('scale')
  const svg = fx(L)

  const bars = MODELS.map((m) => {
    const num = h('b', { class: 'mono', text: '0' })
    const val = h('div', { class: 'bar-val' }, [num, h('span', { text: ' 亿' })])
    const bar = h('div', { class: 'pbar' }, [val])
    Object.assign(bar.style, { left: `${m.x - 70}px`, bottom: `${1080 - BASE}px` })
    L.append(bar)
    const name = label(L, m.name, m.x, BASE + 26, { cls: 'bar-name mono' })
    const year = label(L, m.year, m.x, BASE + 52, { cls: 'bar-year mono' })
    return { bar, num, val, name, year }
  })
  const unit = label(L, '参数量', 440, BASE - 20, { anchor: 'l', cls: 'axis' })
  const floor = s('line', { x1: 480, y1: BASE, x2: 1440, y2: BASE, stroke: C.line, 'stroke-width': 2 })
  svg.append(floor)
  gsap.set(bars.map((b) => b.bar), { height: 0 })

  /** 按“当前最大值”换算柱高：镜头不断拉远 */
  const zoom = (t: number, maxYi: number, upto: number, dur = 1.1) => {
    for (let i = 0; i <= upto; i++) {
      const hh = Math.max(3, (MODELS[i].yi / maxYi) * MAX_H)
      tl.to(bars[i].bar, { height: hh, duration: dur, ease: 'power3.inOut' }, t)
    }
  }

  // 规模定律：对数坐标下的一条直线
  const CX0 = 300
  const CY0 = 230
  const CW = 620
  const CH = 380
  const axes = s('path', { d: `M${CX0},${CY0}V${CY0 + CH}H${CX0 + CW}`, fill: 'none', stroke: C.dim, 'stroke-width': 2 })
  const fit = s('line', { x1: CX0 + 30, y1: CY0 + 40, x2: CX0 + CW - 20, y2: CY0 + CH - 50, stroke: C.clawd, 'stroke-width': 4, 'stroke-linecap': 'round' })
  const pts = Array.from({ length: 7 }, (_, i) => {
    const f = (i + 0.5) / 7
    const x = CX0 + 30 + f * (CW - 50)
    const y = CY0 + 40 + f * (CH - 90) + (i % 2 ? 9 : -7)
    return s('circle', { cx: x, cy: y, r: 9, fill: C.fg })
  })
  svg.append(axes, fit, ...pts)
  gsap.set(fit, { drawSVG: '0%' })
  const xl = label(L, '算力（对数刻度）→', CX0 + CW, CY0 + CH + 28, { anchor: 'r', cls: 'axis' })
  const yl = label(L, '损失（对数刻度）', CX0 - 10, CY0 - 24, { anchor: 'l', cls: 'axis' })
  const lawL = label(L, '幂律', CX0 + CW - 120, CY0 + 120, { cls: 'law seg-o' })

  // GPT-3 论文里的 few-shot 例子
  const answer = h('span', { class: 'shot-a' })
  const shot = h('div', { class: 'shot' }, [
    h('div', { class: 'shot-h', text: 'Translate English to French:' }),
    h('div', { text: 'sea otter => loutre de mer' }),
    h('div', { text: 'peppermint => menthe poivrée' }),
    h('div', {}, ['cheese => ', answer, h('span', { class: 'shot-cur' })]),
  ])
  const ansChars = [...'fromage'].map((c) => h('span', { text: c }))
  answer.append(...ansChars)
  at(shot, 1060, 250)
  L.append(shot)
  const shotCap = label(L, 'GPT-3 论文中的例子', 1060, 520, { anchor: 'l', cls: 'axis' })

  const chartAll = [axes, ...pts, xl, yl, lawL]
  hide(bars.flatMap((b) => [b.bar, b.name, b.year]), unit, floor, chartAll, shot, shotCap)
  gsap.set(ansChars, { display: 'none' })

  d.chapter({
    id: 'scale',
    title: '大力出奇迹：规模定律',
    year: '2020',
    question: '模型为什么越做越大？',
    verb: 'Scaling',
    banner: 'SCALE',
    layer: L,
  })

  d.say('OpenAI 押注了一条最朴素的路线：把模型做大，再做大。', (t) => {
    fadeIn(tl, [floor, unit], t + 0.4, { y: 0 })
    fadeIn(tl, bars.flatMap((b) => [b.name, b.year]), t + 0.6, { y: 8, stagger: 0.08 })
  })

  d.say('2018 年的 GPT-1 有 1.17 亿个参数；一年后的 GPT-2，涨到了 15 亿……', (t) => {
    set(tl, bars[0].bar, { autoAlpha: 1 }, t + 0.3)
    zoom(t + 0.3, 1.5, 0, 0.9)
    countTo(tl, bars[0].num, 1.17, t + 0.3, { dur: 0.9, decimals: 2 })
    set(tl, bars[1].bar, { autoAlpha: 1 }, t + 2.6)
    zoom(t + 2.6, 15, 1)
    countTo(tl, bars[1].num, 15, t + 2.6, { dur: 1.1 })
    sfx.at(t + 2.6, 'whoosh')
  })

  d.say('2020 年的 GPT-3，直接来到 1750 亿！', (t) => {
    set(tl, bars[2].bar, { autoAlpha: 1 }, t + 0.6)
    // 先冲出画面，再把镜头拉远
    tl.to(bars[2].bar, { height: 760, duration: 0.7, ease: 'power2.in' }, t + 0.6)
    countTo(tl, bars[2].num, 1750, t + 0.6, { dur: 1.6 })
    zoom(t + 1.4, 1750, 2, 1.0)
    sfx.at(t + 0.6, 'whoosh')
    sfx.at(t + 1.4, 'thud')
    d.cue('gpt3', t + 1.4)
    clawd.face(tl, 'wide', t + 0.9)
    clawd.look(tl, 'u', t + 0.9)
    clawd.prop(tl, 'bang', t + 1.0, 1.6)
    clawd.look(tl, 'c', t + 3.2)
    clawd.face(tl, 'normal', t + 3.2)
  }, { hold: 2.4 })

  d.say('同年，研究者总结出“规模定律”：模型、数据、算力一起放大，损失就按幂律下降。', (t) => {
    fadeOut(tl, [...bars.flatMap((b) => [b.bar, b.name, b.year]), unit], t + 0.1, { stagger: 0.03 })
    tl.to(floor, { autoAlpha: 0, duration: 0.3 }, t + 0.1)
    fadeIn(tl, [axes, xl, yl], t + 0.6, { y: 0 })
    popIn(tl, pts, t + 1.0, { stagger: 0.12 })
  })

  d.say('画在对数坐标上，几乎是一条笔直的线。', (t) => {
    tl.to(fit, { drawSVG: '100%', duration: 1.0, ease: 'power2.inOut' }, t + 0.3)
    fadeIn(tl, lawL, t + 1.1)
  })

  d.say('更神奇的是，GPT-3 不用重新训练，只看几个例子，就能学会新任务。', (t) => {
    fadeIn(tl, [shot, shotCap], t + 0.4)
    ansChars.forEach((c, i) => {
      set(tl, c, { display: 'inline' }, t + 2.4 + i * 0.09)
      sfx.at(t + 2.4 + i * 0.09, 'key', i)
    })
    clawd.face(tl, 'happy', t + 3.2)
    clawd.face(tl, 'normal', t + 4.8)
  })

  d.end(L)
}
