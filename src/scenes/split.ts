import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { createBanner, revealBanner } from '../ui/banner'
import { arrow, box, chipRow, drawArrow, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

const BX = 500 // BERT 半边的中轴
const GX = 1420 // GPT 半边的中轴

/** 2018：编码器给了 BERT，解码器给了 GPT */
export function split(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('split')
  const svg = fx(L)

  // 一开始：完整的 Transformer（编码器 + 解码器）
  const encBox = box(L, 830, 330, 230, 64, { cls: 'half half-enc', text: '编码器' })
  const decBox = box(L, 1090, 330, 230, 64, { cls: 'half half-dec', text: '解码器' })
  const join = arrow(svg, 948, 330, 972, 330, { head: 8, color: C.dim })

  const bert = createBanner('BERT', { cell: 8, color: C.q })
  const gpt = createBanner('GPT', { cell: 8, color: C.clawd })
  at(bert.el, BX - bert.width / 2, 168)
  at(gpt.el, GX - gpt.width / 2, 168)
  L.append(bert.el, gpt.el)
  const bertWho = label(L, '2018 年 10 月，谷歌', BX, 296, { cls: 'who' })
  const gptWho = label(L, '2018 年 6 月，OpenAI', GX, 296, { cls: 'who' })

  // GPT：文字接龙
  const g = chipRow(L, ['今天', '天气', '真', '？', '，', '适合', '出门'], GX, 450)
  const slot = g.els[3]
  slot.classList.add('slot')
  const gptArcs = [0, 1, 2].map((i) => arrow(svg, g.xs[i], 416, g.xs[3] - 6, 414, { bend: -40 - (3 - i) * 22, color: C.clawd, head: 9, width: 3 }))
  const cands = [
    ['好', 0.62],
    ['热', 0.21],
    ['不错', 0.09],
  ] as const
  const probs = cands.map(([w, p], i) => {
    const row = h('div', { class: 'prob' }, [h('span', { class: 'prob-w', text: w }), h('i'), h('span', { class: 'prob-p mono', text: `${Math.round(p * 100)}%` })])
    ;(row.children[1] as HTMLElement).style.width = `${p * 300}px`
    at(row, g.xs[3] - 40, 512 + i * 46)
    L.append(row)
    return row
  })
  const good = h('div', { class: 'chip fill', text: '好' })
  at(good, g.xs[3], 450)
  L.append(good)
  const gptCap = label(L, '文字接龙：只看前文，预测下一个词', GX, 690, { cls: 'cap seg-o' })

  // BERT：完形填空
  const b = chipRow(L, ['今天', '天气', '真', '[MASK]', '，', '适合', '出门'], BX, 450)
  const mask = b.els[3]
  mask.classList.add('mask')
  const bertArcs = [0, 1, 2, 4, 5, 6].map((i) =>
    arrow(svg, b.xs[i], 416, b.xs[3] + (i < 3 ? -10 : 10), 414, { bend: i < 3 ? -40 - (3 - i) * 22 : 40 + (i - 3) * 22, color: C.q, head: 9, width: 3 }),
  )
  const fillIn = h('div', { class: 'chip fill fill-q', text: '好' })
  at(fillIn, b.xs[3], 450)
  L.append(fillIn)
  const bertCap = label(L, '完形填空：左右两边一起看', BX, 690, { cls: 'cap seg-q' })

  // 海量文本 → 预训练
  const pile = h('div', { class: 'pile' }, [h('i'), h('i'), h('i')])
  at(pile, 960, 560)
  L.append(pile)
  const pileL = label(L, '海量文本', 960, 640, { cls: 'pile-l' })
  // 预训练：同一堆文本，同时喂给两边
  const pre = [arrow(svg, 916, 524, 850, 440, { head: 10, color: C.dim }), arrow(svg, 1004, 524, 1070, 440, { head: 10, color: C.dim })]
  const preL = label(L, '先预训练，再微调', 960, 680, { cls: 'pile-l faint' })

  // 奖杯和“继续变大”
  const trophy = s('svg', { viewBox: '0 0 9 9', width: 72, height: 72, 'shape-rendering': 'crispEdges', class: 'trophy' }, [
    s('path', { d: 'M1 0h7v1h1v2h-1v1h-1v1h-1v1h1v1h1v2h-7v-2h1v-1h1v-1h-1v-1h-1v-1h-1v-2h1z', fill: C.v }),
  ])
  at(trophy, BX + bert.width / 2 + 30, 186)
  L.append(trophy)
  const bigger = label(L, '↗ 越做越大', GX + gpt.width / 2 + 30, 216, { anchor: 'l', cls: 'bigger seg-o' })

  const gptAll = [gptWho, ...g.els, ...probs, good, gptCap]
  const bertAll = [bertWho, ...b.els, fillIn, bertCap]
  hide(encBox, decBox, gptAll, bertAll, pile, pileL, preL, trophy, bigger)

  d.chapter({
    id: 'split',
    title: '2018：BERT 与 GPT 分家',
    year: '2018',
    question: '后来呢？',
    verb: 'Branching',
    layer: L,
  })

  d.say('2018 年，Transformer 一分为二。', (t) => {
    popIn(tl, [encBox, decBox], t + 0.2, { stagger: 0.1 })
    drawArrow(tl, join, t + 0.5, 0.2)
    tl.to([join.path, join.head], { autoAlpha: 0, duration: 0.2 }, t + 1.3)
    tl.to(encBox, { x: BX - 830, y: 0, duration: 0.8, ease: 'power3.inOut' }, t + 1.4)
    tl.to(decBox, { x: GX - 1090, y: 0, duration: 0.8, ease: 'power3.inOut' }, t + 1.4)
    tl.to([encBox, decBox], { autoAlpha: 0, duration: 0.3 }, t + 2.3)
    sfx.at(t + 1.4, 'whoosh')
    revealBanner(tl, gpt, t + 2.3, 0.4)
    revealBanner(tl, bert, t + 2.3, 0.5)
  }, { hold: 1.6 })

  d.say('OpenAI 只用了解码器，做出 {o:GPT}：玩“文字接龙”，根据前文预测下一个词。', (t) => {
    fadeIn(tl, gptWho, t + 0.2, { y: 6 })
    popIn(tl, g.els.slice(0, 4), t + 0.5, { stagger: 0.08 })
    gptArcs.forEach((a, i) => drawArrow(tl, a, t + 1.3 + i * 0.12, 0.4))
    fadeIn(tl, probs, t + 2.0, { stagger: 0.12, y: 0 })
    tl.fromTo(good, { autoAlpha: 0, y: 70 + 72 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, t + 3.1)
    set(tl, slot, { autoAlpha: 0 }, t + 3.5)
    popIn(tl, g.els.slice(4), t + 3.7, { stagger: 0.25 })
    g.els.slice(4).forEach((_, i) => sfx.at(t + 3.7 + i * 0.25, 'tick', i))
    fadeIn(tl, gptCap, t + 4.0)
  })

  d.say('谷歌只用了编码器，做出 {q:BERT}：做“完形填空”，同时看左右两边的上下文。', (t) => {
    fadeIn(tl, bertWho, t + 0.2, { y: 6 })
    popIn(tl, b.els, t + 0.5, { stagger: 0.06 })
    bertArcs.forEach((a, i) => drawArrow(tl, a, t + 1.4 + i * 0.1, 0.4))
    tl.fromTo(fillIn, { autoAlpha: 0, scale: 1.6 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: false }, t + 2.6)
    set(tl, mask, { autoAlpha: 0 }, t + 2.7)
    sfx.at(t + 2.6, 'pop')
    fadeIn(tl, bertCap, t + 3.0)
  })

  d.say('它们都先在海量文本上“预训练”，再拿到具体任务上微调。NLP 从此进入了预训练时代。', (t) => {
    const arcs = [...gptArcs, ...bertArcs].flatMap((a) => [a.path, a.head])
    fadeOut(tl, [...probs, ...arcs, gptCap, bertCap], t + 0.1)
    tl.to([...g.els, good, ...b.els, fillIn], { y: -60, duration: 0.5, ease: 'power2.inOut' }, t + 0.3)
    popIn(tl, pile, t + 0.8)
    fadeIn(tl, [pileL, preL], t + 1.0, { y: 6 })
    pre.forEach((a, i) => drawArrow(tl, a, t + 1.4 + i * 0.2, 0.4))
  })

  d.say('BERT 一度横扫各大榜单；而 GPT 这一支，走上了一条更“简单粗暴”的路……', (t) => {
    popIn(tl, trophy, t + 0.6)
    sfx.at(t + 0.6, 'ding')
    fadeIn(tl, bigger, t + 2.6)
    clawd.look(tl, 'r', t + 2.6)
    clawd.look(tl, 'c', t + 4.4)
  })

  d.end(L)
}
