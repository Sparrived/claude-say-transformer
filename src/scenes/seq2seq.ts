import { gsap } from 'gsap'
import type { Director } from '../director'
import { h, hide, rand, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { chip, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

/** 翻译质量 vs 句子长度的示意图（Seq2Seq 和注意力两章共用） */
export function qualityChart(parent: HTMLElement, svg: SVGSVGElement, x0: number, y0: number) {
  const W = 380
  const H = 300
  const axes = s('path', {
    d: `M${x0},${y0}V${y0 + H}H${x0 + W}`,
    fill: 'none',
    stroke: C.dim,
    'stroke-width': 2,
  })
  // 示意曲线：短句时差不多，句子一长 Seq2Seq 掉得厉害（形状参考 Bahdanau et al. 2014 图 2）
  const plain = s('path', {
    d: `M${x0 + 10},${y0 + 60} C${x0 + 120},${y0 + 52} ${x0 + 170},${y0 + 66} ${x0 + 220},${y0 + 120} S${x0 + 330},${y0 + 250} ${x0 + W - 10},${y0 + 262}`,
    fill: 'none',
    stroke: C.clawd,
    'stroke-width': 4,
    'stroke-linecap': 'round',
  })
  const attn = s('path', {
    d: `M${x0 + 10},${y0 + 50} C${x0 + 140},${y0 + 40} ${x0 + 260},${y0 + 52} ${x0 + W - 10},${y0 + 72}`,
    fill: 'none',
    stroke: C.k,
    'stroke-width': 4,
    'stroke-linecap': 'round',
  })
  svg.append(axes, plain, attn)
  const xl = label(parent, '句子长度 →', x0 + W, y0 + H + 28, { anchor: 'r', cls: 'axis' })
  const yl = label(parent, '翻译质量', x0 - 10, y0 - 22, { anchor: 'l', cls: 'axis' })
  const plainL = label(parent, 'Seq2Seq', x0 + 236, y0 + 214, { anchor: 'r', cls: 'curve-l seg-o mono' })
  const attnL = label(parent, '+ 注意力', x0 + W - 4, y0 + 40, { anchor: 'r', cls: 'curve-l seg-k' })
  const note = label(parent, '示意图', x0 + 8, y0 + H + 28, { anchor: 'l', cls: 'axis faint' })
  gsap.set([plain, attn], { drawSVG: '0%' })
  hide(axes, xl, yl, plainL, attnL, note)
  return {
    show(tl: gsap.core.Timeline, t: number) {
      fadeIn(tl, [axes, xl, yl, note], t, { y: 0 })
    },
    drawPlain(tl: gsap.core.Timeline, t: number, dur = 1.4) {
      tl.to(plain, { drawSVG: '100%', duration: dur, ease: 'power1.inOut' }, t)
      fadeIn(tl, plainL, t + dur * 0.8, { y: 6 })
    },
    drawAttn(tl: gsap.core.Timeline, t: number, dur = 1.2) {
      tl.to(attn, { drawSVG: '100%', duration: dur, ease: 'power1.inOut' }, t)
      fadeIn(tl, attnL, t + dur * 0.8, { y: 6 })
    },
  }
}

const SRC = ['The', 'cat', 'sat', 'on', 'the', 'mat']
const TGT = ['猫', '坐', '在', '垫子', '上']
const LONG = 'The cat which had been chasing butterflies in the garden all afternoon finally sat down on the old mat'.split(' ')

export function seq2seq(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('seq2seq')
  const svg = fx(L)

  const VX = 780 // 中间那个向量
  const VY = 435
  const srcY = (i: number) => 260 + i * 70
  const tgtY = (i: number) => 295 + i * 70

  const funnel = (pts: string) => s('polygon', { points: pts, fill: 'rgba(255,255,255,0.025)', stroke: C.line, 'stroke-width': 2 })
  const enc = funnel('340,222 724,398 724,472 340,648')
  const dec = funnel('836,398 1220,222 1220,648 836,472')
  svg.append(enc, dec)
  const encL = label(L, '编码器 RNN', 500, 435, { cls: 'funnel-l' })
  const decL = label(L, '解码器 RNN', 1060, 435, { cls: 'funnel-l' })

  const vcells = Array.from({ length: 4 }, () => h('i'))
  const vec = h('div', { class: 'ctx-vec' }, vcells)
  Object.assign(vec.style, { left: `${VX}px`, top: `${VY}px` })
  const vecL = label(L, '固定长度的向量', VX, 352, { cls: 'vec-l' })
  L.append(vec)

  const src = SRC.map((w, i) => chip(L, w, 250, srcY(i), { w: 120, cls: 'mono' }))
  const tgt = TGT.map((w, i) => chip(L, w, 1310, tgtY(i), { w: 120 }))
  const longToks = LONG.map((w, i) => chip(L, w, 250, 236 + i * 22.4, { cls: 'mini mono' }))
  const bad = ['猫', '坐…', '？', '？']
  const badToks = bad.map((w, i) => chip(L, w, 1310, tgtY(i), { w: 120, cls: i > 1 ? 'bad' : '' }))

  const dot = () => {
    const el = h('div', { class: 'dot' })
    L.append(el)
    hide(el)
    return el
  }

  const chart = qualityChart(L, svg, 1462, 250)

  hide(enc, dec, encL, decL, vec, vecL, src, tgt, longToks, badToks)
  gsap.set(vcells, { backgroundColor: C.ink3 })

  /** 一个小橙点从 (x1,y1) 飞到 (x2,y2) */
  const fly = (x1: number, y1: number, x2: number, y2: number, t: number, dur = 0.45, lost = false) => {
    const el = dot()
    tl.fromTo(el, { autoAlpha: 1, x: x1, y: y1, scale: 1 }, { x: x2, y: y2, scale: 0.6, duration: dur, ease: 'power2.in', immediateRender: false }, t)
    if (lost) {
      // 挤不进去的信息：被弹开、掉落
      tl.to(el, { x: x2 - 40 - rand(x1 + y1) * 80, y: y2 + 160 + rand(y1) * 140, duration: 0.6, ease: 'power1.in' }, t + dur)
      tl.to(el, { autoAlpha: 0, duration: 0.3 }, t + dur + 0.3)
    } else set(tl, el, { autoAlpha: 0 }, t + dur)
  }

  d.chapter({
    id: 'seq2seq',
    title: 'Seq2Seq：信息瓶颈',
    year: '2014',
    question: '那机器翻译呢？',
    verb: 'Translating',
    banner: 'SEQ2SEQ',
    layer: L,
  })

  d.say('2014 年，谷歌的研究者提出了 {o:Seq2Seq}：一个 RNN 读原文，另一个 RNN 写译文。', (t) => {
    popIn(tl, src, t + 0.4, { stagger: 0.05 })
    fadeIn(tl, [enc, encL], t + 0.7, { y: 0 })
    fadeIn(tl, vec, t + 0.9, { y: 0 })
    fadeIn(tl, [dec, decL], t + 1.1, { y: 0 })
    src.forEach((_, i) => {
      fly(310, srcY(i), VX, VY, t + 1.4 + i * 0.28)
      set(tl, vcells[i % 4], { backgroundColor: C.clawd }, t + 1.85 + i * 0.28)
      sfx.at(t + 1.4 + i * 0.28, 'tick', i)
    })
    const out = t + 1.4 + SRC.length * 0.28 + 0.4
    tgt.forEach((c, i) => {
      fly(VX, VY, 1250, tgtY(i), out + i * 0.3, 0.35)
      popIn(tl, c, out + 0.3 + i * 0.3)
    })
  })

  d.say('两者之间，只靠一个固定长度的向量传话：整句话的意思，全压在这几个数字里。', (t) => {
    fadeIn(tl, vecL, t + 0.4, { y: 6 })
    tl.to(vec, { scale: 1.25, duration: 0.25, repeat: 3, yoyo: true, ease: 'power1.inOut' }, t + 0.6)
  })

  d.say('短句子还行。可要是句子很长……', (t) => {
    fadeOut(tl, [src, tgt], t + 0.2, { stagger: 0.02 })
    tl.to(vcells, { backgroundColor: C.ink3, duration: 0.2 }, t + 0.2)
    popIn(tl, longToks, t + 0.6, { stagger: 0.03, from: 0.6 })
    LONG.forEach((_, i) => {
      const s0 = t + 1.4 + i * 0.09
      fly(300, 236 + i * 22.4, VX, VY, s0, 0.4, i % 3 !== 0 && i > 3)
      sfx.at(s0, 'tick', i)
    })
    tl.to(vcells, { backgroundColor: C.clawd, duration: 0.1, stagger: 0.25 }, t + 1.6)
    tl.to(vec, { x: 5, duration: 0.05, repeat: 15, yoyo: true, ease: 'none' }, t + 2.4)
  })

  d.say('就像让你把一整页书背成一句话，再凭这一句话把它翻译出来。', (t) => {
    badToks.forEach((c, i) => {
      fly(VX, VY, 1250, tgtY(i), t + 0.3 + i * 0.35, 0.35)
      popIn(tl, c, t + 0.6 + i * 0.35)
    })
    clawd.prop(tl, 'sweat', t + 0.8, 3)
    clawd.face(tl, 'closed', t + 0.8)
    clawd.face(tl, 'normal', t + 3.4)
  })

  d.say('句子越长，翻译质量掉得越厉害。这就是有名的“信息瓶颈”。', (t) => {
    chart.show(tl, t + 0.2)
    chart.drawPlain(tl, t + 0.6)
  })

  d.end(L)
}
