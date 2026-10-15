import { gsap } from 'gsap'
import katex from 'katex'
import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { chip, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'
import { SENTENCE } from './rnn'

const IT = 5
// “它”的 Query 与每个词 Key 的点积（已除以 √dₖ，示意）
const SCORES = [4.1, 0.2, 0.1, 1.3, 0.3, 1.0, 0.2, 0.9, 0.1]
const exp = SCORES.map(Math.exp)
const WEIGHTS = exp.map((e) => e / exp.reduce((a, b) => a + b, 0))

export const FORMULA =
  String.raw`\mathrm{Attention}(\textcolor{#B1B9F9}{Q},\textcolor{#4EBA65}{K},\textcolor{#FFC107}{V})=\mathrm{softmax}\!\left(\frac{\textcolor{#B1B9F9}{Q}\textcolor{#4EBA65}{K}^{\top}}{\sqrt{d_k}}\right)\textcolor{#FFC107}{V}`

export function selfattn(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('selfattn')
  const svg = fx(L)
  const X = (i: number) => 240 + i * 180
  const TOK_Y = 656
  const QKV_Y = 566
  const SCORE_Y = 478
  const BASE = 440

  const toks = SENTENCE.map((w, i) => chip(L, w, X(i), TOK_Y, { w: 112 }))
  const qkv = SENTENCE.map((_, i) =>
    (['q', 'k', 'v'] as const).map((k, j) => {
      const el = h('div', { class: `qkv qkv-${k}`, text: k.toUpperCase() })
      at(el, X(i) + (j - 1) * 38, QKV_Y)
      L.append(el)
      return el
    }),
  )
  const ks = qkv.map((r) => r[1])

  // 图例
  const legend = h('div', { class: 'legend' }, [
    h('div', {}, [h('b', { class: 'qkv qkv-q', text: 'Q' }), h('span', { text: 'Query：我在找什么' })]),
    h('div', {}, [h('b', { class: 'qkv qkv-k', text: 'K' }), h('span', { text: 'Key：我是什么' })]),
    h('div', {}, [h('b', { class: 'qkv qkv-v', text: 'V' }), h('span', { text: 'Value：我能提供什么' })]),
  ])
  at(legend, 960, 300)
  L.append(legend)

  // “它”的 Query 探头
  const probe = h('div', { class: 'qkv qkv-q probe', text: 'Q' })
  L.append(probe)
  const scores = SCORES.map((v, i) => label(L, v.toFixed(1), X(i), SCORE_Y, { cls: 'score mono' }))

  // softmax 之后的权重柱
  const bars = WEIGHTS.map((w, i) => {
    const b = h('div', { class: 'wbar' })
    Object.assign(b.style, { left: `${X(i) - 22}px`, top: `${BASE - Math.max(4, w * 230)}px`, height: `${Math.max(4, w * 230)}px` })
    L.append(b)
    return b
  })
  const pcts = WEIGHTS.map((w, i) => label(L, `${Math.round(w * 100)}%`, X(i), BASE - Math.max(4, w * 230) - 22, { cls: 'pct mono' }))

  // Value 汇入“它”
  const flows = WEIGHTS.map((w, i) => {
    const x1 = X(i) + 38
    const y1 = QKV_Y + 16
    const x2 = X(IT)
    const y2 = TOK_Y - 36
    const p = s('path', {
      d: `M${x1},${y1} C${x1},${y1 + 60} ${x2},${y2 - 70} ${x2},${y2}`,
      fill: 'none',
      stroke: C.v,
      'stroke-width': 2 + w * 14,
      'stroke-linecap': 'round',
      opacity: 0.25 + w * 0.75,
    })
    svg.append(p)
    gsap.set(p, { drawSVG: '0%' })
    return p
  })
  const itIs = label(L, '它 ≈ 小猫', X(IT), TOK_Y + 62, { cls: 'it-is' })

  // 公式
  const formula = h('div', { class: 'formula' })
  katex.render(FORMULA, formula, { throwOnError: false, displayMode: true })
  at(formula, 960, 238)
  L.append(formula)

  // 每个词都看所有词：两两之间的弧线
  const arcs: SVGPathElement[] = []
  for (let i = 0; i < SENTENCE.length; i++)
    for (let j = i + 1; j < SENTENCE.length; j++) {
      const hgt = 40 + (j - i) * 34
      const p = s('path', {
        d: `M${X(i)},${TOK_Y - 36} C${X(i)},${TOK_Y - 36 - hgt} ${X(j)},${TOK_Y - 36 - hgt} ${X(j)},${TOK_Y - 36}`,
        fill: 'none',
        stroke: C.q,
        'stroke-width': 2,
        opacity: 0.45,
      })
      svg.append(p)
      gsap.set(p, { drawSVG: '0%' })
      arcs.push(p)
    }
  const oneStep = label(L, '所有词同时进行，一步到位', 960, 300, { cls: 'one-step' })

  hide(toks, qkv.flat(), legend, probe, scores, bars, pcts, itIs, formula, oneStep)

  d.chapter({
    id: 'selfattn',
    title: '自注意力：Q、K、V',
    year: '2017',
    question: '自注意力到底在算什么？',
    verb: 'Attending',
    banner: 'SELF-ATTENTION',
    color: C.q,
    layer: L,
  })

  d.say('还是那句话：“小猫没有过马路，因为它太累了。”这回换 Transformer 来读。', (t) => {
    popIn(tl, toks, t + 0.4, { stagger: 0.05 })
  })

  d.say('每个词都会生成三个向量：{q:Query}、{k:Key} 和 {v:Value}。', (t) => {
    SENTENCE.forEach((_, i) => popIn(tl, qkv[i], t + 0.8 + i * 0.08, { stagger: 0.05 }))
  })

  d.say('{q:Query} 是“我在找什么”，{k:Key} 是“我是什么”，{v:Value} 是“我能提供什么”。', (t) => {
    fadeIn(tl, legend, t + 0.3)
  })

  d.say('“它”拿着自己的 {q:Query}，去和每个词的 {k:Key} 做点积，算出相关程度。', (t) => {
    fadeOut(tl, legend, t)
    tl.to(toks[IT], { borderColor: C.q, color: C.q, duration: 0.25 }, t + 0.3)
    // 探头从“它”出发，挨个碰一碰每个词的 Key
    tl.fromTo(probe, { autoAlpha: 1, x: X(IT) - 38, y: QKV_Y }, { y: QKV_Y - 46, duration: 0.3, ease: 'power2.out', immediateRender: false }, t + 0.5)
    tl.to(probe, { x: X(0), duration: 0.45, ease: 'power2.inOut' }, t + 0.85)
    SENTENCE.forEach((_, i) => {
      const s0 = t + 1.35 + i * 0.3
      if (i > 0) tl.to(probe, { x: X(i), duration: 0.18, ease: 'power1.inOut' }, s0 - 0.18)
      tl.to(ks[i], { scale: 1.3, duration: 0.1, yoyo: true, repeat: 1 }, s0)
      popIn(tl, scores[i], s0 + 0.05)
      sfx.at(s0, 'tick', i)
    })
    tl.to(probe, { autoAlpha: 0, duration: 0.25 }, t + 1.35 + SENTENCE.length * 0.3)
  })

  d.say('再用 {o:softmax} 把分数变成权重：“小猫”一下子拿走了八成。', (t) => {
    fadeOut(tl, scores, t + 0.3, { stagger: 0.02 })
    bars.forEach((b, i) =>
      tl.fromTo(b, { autoAlpha: 1, scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power3.out', immediateRender: false }, t + 0.6 + i * 0.05),
    )
    fadeIn(tl, pcts, t + 1.1, { y: 6, stagger: 0.04 })
    tl.to(toks[0], { borderColor: C.clawd, color: C.clawd, duration: 0.25 }, t + 1.4)
  })

  d.say('最后按权重把大家的 {v:Value} 加起来，“它”就知道自己指的是小猫了。', (t) => {
    flows.forEach((p, i) => tl.to(p, { drawSVG: '100%', duration: 0.7, ease: 'power2.inOut' }, t + 0.6 + i * 0.04))
    tl.to(toks[IT], { borderColor: C.clawd, color: C.clawd, backgroundColor: 'rgba(215,119,87,0.18)', duration: 0.3 }, t + 1.5)
    popIn(tl, itIs, t + 1.7)
    clawd.face(tl, 'happy', t + 1.8)
    clawd.face(tl, 'normal', t + 3.6)
  })

  d.say('整个过程，就是论文里的这一行公式。', (t) => {
    fadeOut(tl, [...bars, ...pcts, ...flows], t + 0.1)
    fadeIn(tl, formula, t + 0.5, { y: 16 })
  }, { hold: 2.6 })

  d.say('而且不只是“它”：每个词都在同时这样做，隔得再远，也只要一步。', (t) => {
    fadeOut(tl, [formula, itIs], t + 0.1)
    tl.to(toks, { borderColor: C.q, color: C.fg, backgroundColor: 'rgba(0,0,0,0)', duration: 0.3 }, t + 0.4)
    set(tl, qkv.flat(), { autoAlpha: 0 }, t + 0.4)
    arcs.forEach((p) => tl.to(p, { drawSVG: '100%', duration: 0.9, ease: 'power2.out' }, t + 0.7))
    fadeIn(tl, oneStep, t + 1.6)
    sfx.at(t + 0.7, 'whoosh')
  })

  d.end(L)
}
