import { gsap } from 'gsap'
import type { Director } from '../director'
import { h, hide, s, set } from '../lib/dom'
import { C, mix } from '../lib/colors'
import { box, chip, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'
import { qualityChart } from './seq2seq'

const SRC = ['The', 'cat', 'sat', 'on', 'the', 'mat']
const TGT = ['猫', '坐', '在', '垫子', '上']
// 注意力权重（示意）：行 = 译文的词，列 = 原文的词
const W = [
  [0.12, 0.8, 0.04, 0.01, 0.02, 0.01],
  [0.02, 0.06, 0.85, 0.04, 0.01, 0.02],
  [0.01, 0.02, 0.15, 0.72, 0.06, 0.04],
  [0.01, 0.02, 0.02, 0.04, 0.1, 0.81],
  [0.01, 0.01, 0.04, 0.58, 0.06, 0.3],
]

export function attention(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('attention')
  const svg = fx(L)

  const SY = 262
  const TY = 610
  const sx = (i: number) => 250 + i * 160
  const tx = (j: number) => 330 + j * 175

  const src = SRC.map((w, i) => chip(L, w, sx(i), SY, { w: 116, cls: 'mono' }))
  const tgt = TGT.map((w, j) => chip(L, w, tx(j), TY, { w: 116 }))
  const srcL = label(L, '原文', 92, SY, { anchor: 'l', cls: 'row-l' })
  const tgtL = label(L, '译文', 92, TY, { anchor: 'l', cls: 'row-l' })

  // 每个译文词 → 所有原文词 的连线，粗细 = 注意力权重
  const links = W.map((row, j) =>
    row.map((w, i) => {
      const x1 = tx(j)
      const y1 = TY - 36
      const x2 = sx(i)
      const y2 = SY + 36
      const p = s('path', {
        d: `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`,
        fill: 'none',
        stroke: C.clawd,
        'stroke-width': 1.5 + w * 14,
        'stroke-linecap': 'round',
      })
      svg.append(p)
      gsap.set(p, { drawSVG: '0%', opacity: 0.18 + w * 0.82 })
      return p
    }),
  )

  // 对齐热力图
  const HX = 1352
  const HY = 300
  const CELL = 58
  const heat = h('div', { class: 'heat' })
  Object.assign(heat.style, { left: `${HX}px`, top: `${HY}px` })
  const heatCells = W.map((row) =>
    row.map((w) => {
      const c = h('i')
      c.style.background = mix(C.ink2, C.clawd, Math.min(1, w * 1.15))
      heat.append(c)
      return c
    }),
  )
  const heatCols = SRC.map((w, i) => label(L, w, HX + i * CELL + CELL / 2, HY - 26, { cls: 'heat-l mono' }))
  const heatRows = TGT.map((w, j) => label(L, w, HX - 14, HY + j * CELL + CELL / 2, { anchor: 'r', cls: 'heat-l' }))
  L.append(heat)

  const rnnNote = box(L, 960, 712, 760, 52, { cls: 'rnn-note', text: '底层还是一步一步跑的 RNN' })

  const chart = qualityChart(L, svg, 1420, 250)

  hide(src, tgt, srcL, tgtL, heat, heatCols, heatRows, rnnNote, heatCells.flat())

  d.chapter({
    id: 'attention',
    title: '注意力：回头看',
    year: '2014',
    question: '怎么打破这个瓶颈？',
    verb: 'Attending',
    banner: 'ATTENTION',
    color: C.k,
    layer: L,
  })

  d.say('同一年，{o:Bahdanau}、{o:Cho} 和 {o:Bengio} 想到一个好办法：别死记，回头看！', (t) => {
    popIn(tl, src, t + 0.5, { stagger: 0.05 })
    fadeIn(tl, [srcL, tgtL], t + 0.5, { y: 0 })
    clawd.face(tl, 'happy', t + 1.5)
    clawd.prop(tl, 'bang', t + 1.5, 1.4)
    clawd.face(tl, 'normal', t + 3.2)
  })

  // 一个词一个词地生成译文，每生成一个就“回头看”一次
  const gen = (t: number, j: number, keep = 0.9) => {
    popIn(tl, tgt[j], t)
    sfx.at(t, 'tick', j)
    links[j].forEach((p) => tl.to(p, { drawSVG: '100%', duration: 0.45, ease: 'power2.out' }, t + 0.1))
    const top = W[j].indexOf(Math.max(...W[j]))
    tl.to(src[top], { borderColor: C.clawd, color: C.clawd, duration: 0.2 }, t + 0.3)
    tl.to(src[top], { borderColor: C.line, color: C.fg, duration: 0.3 }, t + keep)
    heatCells[j].forEach((c, i) => set(tl, c, { autoAlpha: 1 }, t + 0.2 + i * 0.04))
    // 看完就淡下去，给下一个词让位置
    links[j].forEach((p, i) => tl.to(p, { opacity: 0.06 + W[j][i] * 0.25, duration: 0.3 }, t + keep))
  }

  d.say('译文每写一个词，都能回头看原文的每一个词，再决定把注意力放在哪儿。', (t) => {
    fadeIn(tl, [heat, ...heatCols, ...heatRows], t + 0.3, { y: 0 })
    TGT.forEach((_, j) => gen(t + 0.6 + j * 0.9, j))
  })

  d.say('连线越粗，注意力越集中。写“垫子”的时候，目光就落在了 mat 上。', (t) => {
    links[3].forEach((p, i) => tl.to(p, { opacity: 0.18 + W[3][i] * 0.82, duration: 0.3 }, t + 0.5))
    tl.to([tgt[3], src[5]], { borderColor: C.clawd, color: C.clawd, duration: 0.25 }, t + 0.6)
    tl.to(heatCells[3][5], { scale: 1.25, duration: 0.25, repeat: 3, yoyo: true }, t + 0.8)
  })

  d.say('把权重排成一张表，就能看到：模型自己学会了两种语言之间的“对齐”。', (t) => {
    tl.to([tgt[3], src[5]], { borderColor: C.line, color: C.fg, duration: 0.25 }, t + 0.2)
    links[3].forEach((p, i) => tl.to(p, { opacity: 0.06 + W[3][i] * 0.25, duration: 0.3 }, t + 0.2))
    tl.fromTo(heat, { outlineColor: 'rgba(215,119,87,0)' }, { outlineColor: 'rgba(215,119,87,1)', duration: 0.4, repeat: 1, yoyo: true, immediateRender: false }, t + 0.6)
  })

  d.say('有了注意力，长句子的翻译质量终于不再一路往下掉。', (t) => {
    fadeOut(tl, [heat, ...heatCols, ...heatRows], t + 0.1)
    chart.show(tl, t + 0.4)
    chart.drawPlain(tl, t + 0.5, 0.6)
    chart.drawAttn(tl, t + 1.3)
  })

  d.say('不过这时的注意力，还只是 RNN 的“外挂”。真正干活的，还是那个慢吞吞的 RNN。', (t) => {
    fadeIn(tl, rnnNote, t + 0.6)
  })

  d.end(L)
}
