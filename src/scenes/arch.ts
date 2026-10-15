import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { arrow, box, countTo, drawArrow, fadeIn, fx, label, popIn, type Arrow } from '../lib/viz'

const EX = 620 // 编码器中轴
const DX = 1080 // 解码器中轴
const BW = 290
const BH = 34
const Y = {
  emb: 716,
  pe: 664,
  l1: 612,
  l2: 560,
  l3: 508,
  l4: 456,
  l5: 404,
  l6: 352,
  linear: 290,
  softmax: 238,
}

type Kind = 'attn' | 'norm' | 'ffn' | 'emb' | 'out'

/** 论文图 1 的结构图，用终端风格重画 */
export function arch(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('arch')
  const svg = fx(L)

  const block = (x: number, y: number, text: string, kind: Kind) => box(L, x, y, BW, BH, { cls: `ab ab-${kind}`, text })
  const enc = [
    block(EX, Y.emb, 'Input Embedding', 'emb'),
    block(EX, Y.l1, 'Multi-Head Attention', 'attn'),
    block(EX, Y.l2, 'Add & Norm', 'norm'),
    block(EX, Y.l3, 'Feed Forward', 'ffn'),
    block(EX, Y.l4, 'Add & Norm', 'norm'),
  ]
  const dec = [
    block(DX, Y.emb, 'Output Embedding', 'emb'),
    block(DX, Y.l1, 'Masked Multi-Head Attention', 'attn'),
    block(DX, Y.l2, 'Add & Norm', 'norm'),
    block(DX, Y.l3, 'Multi-Head Attention', 'attn'),
    block(DX, Y.l4, 'Add & Norm', 'norm'),
    block(DX, Y.l5, 'Feed Forward', 'ffn'),
    block(DX, Y.l6, 'Add & Norm', 'norm'),
  ]
  const head = [block(DX, Y.linear, 'Linear', 'out'), block(DX, Y.softmax, 'Softmax', 'out')]
  const pes = [EX, DX].map((x) => {
    const c = box(L, x, Y.pe, 28, 28, { cls: 'pe-plus', text: '+' })
    const w = label(L, '∿', x + (x === EX ? -46 : 46), Y.pe, { cls: 'pe-wave' })
    return [c, w]
  })
  const encFrame = box(L, EX, 534, BW + 52, 216, { cls: 'aframe' })
  const decFrame = box(L, DX, 482, BW + 52, 320, { cls: 'aframe' })
  const labels = [
    label(L, '编码器', EX - 196, 486, { anchor: 'r', cls: 'arch-name' }),
    label(L, '解码器', DX + 196, 430, { anchor: 'l', cls: 'arch-name' }),
    label(L, '输入', EX, 752, { cls: 'arch-io' }),
    label(L, '已生成的输出', DX, 752, { cls: 'arch-io' }),
    label(L, '下一个词的概率', DX, 196, { cls: 'arch-io' }),
  ]
  const nx = [label(L, '6×', EX - 196, 560, { anchor: 'r', cls: 'nx mono' }), label(L, '×6', DX + 196, 506, { anchor: 'l', cls: 'nx mono' })]

  // 竖直方向的连接箭头
  const up = (x: number, y1: number, y2: number) => arrow(svg, x, y1, x, y2, { head: 8, width: 2 })
  const encArrows = [
    up(EX, Y.emb - 17, Y.pe + 14),
    up(EX, Y.pe - 14, Y.l1 + 17),
    up(EX, Y.l1 - 17, Y.l2 + 17),
    up(EX, Y.l2 - 17, Y.l3 + 17),
    up(EX, Y.l3 - 17, Y.l4 + 17),
  ]
  const decArrows = [
    up(DX, Y.emb - 17, Y.pe + 14),
    up(DX, Y.pe - 14, Y.l1 + 17),
    up(DX, Y.l1 - 17, Y.l2 + 17),
    up(DX, Y.l2 - 17, Y.l3 + 17),
    up(DX, Y.l3 - 17, Y.l4 + 17),
    up(DX, Y.l4 - 17, Y.l5 + 17),
    up(DX, Y.l5 - 17, Y.l6 + 17),
    up(DX, Y.l6 - 17, Y.linear + 17),
    up(DX, Y.linear - 17, Y.softmax + 17),
    up(DX, Y.softmax - 17, 214),
  ]

  // 残差连接：绕过子层，直接加到 Add & Norm 上
  const residual = (x: number, from: number, to: number, side: -1 | 1): Arrow => {
    const path = s('path', {
      d: `M${x},${from}H${x + side * 160}V${to}H${x + side * (BW / 2 + 9)}`,
      fill: 'none',
      stroke: C.dim,
      'stroke-width': 2,
    })
    const headEl = s('path', {
      d: side < 0 ? `M${x - BW / 2},${to}l-10,-6v12z` : `M${x + BW / 2},${to}l10,-6v12z`,
      fill: C.dim,
    })
    svg.append(path, headEl)
    gsap.set(path, { drawSVG: '0%' })
    gsap.set(headEl, { autoAlpha: 0 })
    return { path, head: headEl }
  }
  const residuals = [
    residual(EX, 642, Y.l2, -1),
    residual(EX, 534, Y.l4, -1),
    residual(DX, 642, Y.l2, 1),
    residual(DX, 534, Y.l4, 1),
    residual(DX, 430, Y.l6, 1),
  ]

  // 编码器 → 解码器的交叉注意力
  const crossPath = `M${EX},${Y.l4 - 17}V398H${DX - 210}V${Y.l3}H${DX - BW / 2 - 2}`
  const cross = s('path', { d: crossPath, fill: 'none', stroke: C.clawd, 'stroke-width': 4, 'stroke-linejoin': 'round' })
  const crossHead = s('path', { d: `M${DX - BW / 2},${Y.l3}l-14,-8v16z`, fill: C.clawd })
  svg.append(cross, crossHead)
  gsap.set(cross, { drawSVG: '0%' })
  gsap.set(crossHead, { autoAlpha: 0 })

  // 一个 token 走完整条数据流
  const flowPath = `M${EX},750V${Y.l4 - 17}V398H${DX - 210}V${Y.l3}H${DX}V214`
  const pulse = h('div', { class: 'dot pulse' })
  L.append(pulse)

  const results = h('div', { class: 'results' }, [
    h('div', { class: 'res-row' }, [h('span', { text: 'WMT 2014 英→德' }), h('b', { class: 'n1', text: '0' }), h('i', { text: 'BLEU' })]),
    h('div', { class: 'res-row' }, [h('span', { text: 'WMT 2014 英→法' }), h('b', { class: 'n2', text: '0' }), h('i', { text: 'BLEU' })]),
    h('div', { class: 'res-note', text: '均为当时最好成绩' }),
    h('div', { class: 'res-cost', text: '8 块 P100 GPU，训练 3.5 天' }),
  ])
  at(results, 1400, 300)
  L.append(results)

  const blocks = [...enc, ...dec, ...head]
  const allArrows = [...encArrows, ...decArrows]
  hide(blocks, pes.flat(), encFrame, decFrame, labels, nx, pulse, results)

  d.chapter({
    id: 'arch',
    title: 'Transformer 的完整结构',
    year: '2017',
    question: '完整的 Transformer 长什么样？',
    verb: 'Assembling',
    layer: L,
  })

  d.say('把这些零件组装起来，就是论文里那张著名的结构图。', (t) => {
    const order = [enc[0], pes[0][0], enc[1], enc[2], enc[3], enc[4], dec[0], pes[1][0], dec[1], dec[2], dec[3], dec[4], dec[5], dec[6], head[0], head[1]]
    popIn(tl, order, t + 0.3, { stagger: 0.09, from: 0.6 })
    order.forEach((_, i) => i % 2 === 0 && sfx.at(t + 0.3 + i * 0.09, 'tick', i))
    fadeIn(tl, [pes[0][1], pes[1][1]], t + 0.6, { y: 0 })
    allArrows.forEach((a, i) => drawArrow(tl, a, t + 0.5 + i * 0.07, 0.2))
    fadeIn(tl, [encFrame, decFrame, ...labels], t + 1.6, { y: 0 })
  })

  d.say('左边是编码器，负责读懂输入；右边是解码器，负责一个词一个词地写出输出。', (t) => {
    tl.to(encFrame, { borderColor: C.clawd, duration: 0.3, repeat: 1, yoyo: true, repeatDelay: 0.8 }, t + 0.4)
    tl.to(decFrame, { borderColor: C.clawd, duration: 0.3, repeat: 1, yoyo: true, repeatDelay: 0.8 }, t + 2.2)
    set(tl, pulse, { autoAlpha: 1 }, t + 0.4)
    tl.fromTo(pulse, { x: EX, y: 750 }, { motionPath: { path: flowPath }, duration: 3.4, ease: 'power1.inOut', immediateRender: false }, t + 0.4)
    set(tl, pulse, { autoAlpha: 0 }, t + 3.8)
  })

  d.say('每一层都是：多头注意力，残差连接加归一化，再接一个前馈网络。原版各叠了 6 层。', (t) => {
    residuals.forEach((r, i) => drawArrow(tl, r, t + 0.8 + i * 0.25, 0.5))
    tl.to([enc[1], enc[3], dec[1], dec[5]], { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1 }, t + 0.6)
    popIn(tl, nx, t + 3.0)
  })

  d.say('解码器中间还有一层“交叉注意力”，回头去看编码器的结果。眼熟吧？正是 2014 年那一招。', (t) => {
    tl.to(cross, { drawSVG: '100%', duration: 1.0, ease: 'power2.inOut' }, t + 0.6)
    set(tl, crossHead, { autoAlpha: 1 }, t + 1.55)
    tl.to(dec[3], { backgroundColor: 'rgba(215,119,87,0.45)', duration: 0.3, repeat: 3, yoyo: true }, t + 1.6)
    clawd.face(tl, 'happy', t + 2.6)
    clawd.face(tl, 'normal', t + 4.4)
  })

  d.say('结果，它在英德、英法翻译上双双刷新纪录；最大的模型只用 8 块 GPU 训练了 3.5 天。', (t) => {
    fadeIn(tl, results, t + 0.4)
    countTo(tl, results.querySelector('.n1')!, 28.4, t + 0.8, { dur: 1.2, decimals: 1 })
    countTo(tl, results.querySelector('.n2')!, 41.8, t + 1.2, { dur: 1.2, decimals: 1 })
    sfx.at(t + 2.4, 'ding')
  })

  d.end(L)
}
