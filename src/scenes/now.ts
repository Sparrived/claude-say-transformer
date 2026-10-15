import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { CLAWD_PX, HEADING_Y, MARGIN, STAGE_CX } from '../layout'
import { arrow, chip, drawArrow, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

// 上下文窗口：对数坐标
const AX0 = 300
const DEC = 260 // 每个数量级的宽度
const pos = (n: number) => AX0 + (Math.log10(n) - 2) * DEC
const CTX = [
  { n: 512, v: '512', who: 'BERT，2018' },
  { n: 2048, v: '2,048', who: 'GPT-3，2020' },
  { n: 100_000, v: '10 万', who: 'Claude，2023' },
  { n: 1_000_000, v: '100 万', who: '2024 年起' },
]

export function now(d: Director) {
  const { tl, clawd, term, sfx } = d
  const L = d.layer('now')
  const svg = fx(L)

  // ── 上下文窗口 ──
  const AY = 400
  const axis = s('line', { x1: AX0, y1: AY, x2: pos(1e7), y2: AY, stroke: C.line, 'stroke-width': 2 })
  svg.append(axis)
  const ticks = [100, 1e3, 1e4, 1e5, 1e6, 1e7].map((n, i) => {
    const x = pos(n)
    const tk = s('line', { x1: x, y1: AY, x2: x, y2: AY + 10, stroke: C.dim, 'stroke-width': 2 })
    svg.append(tk)
    return [tk, label(L, ['100', '1K', '10K', '100K', '1M', '10M'][i], x, AY + 32, { cls: 'tick-l mono' })]
  })
  const ctxBar = h('div', { class: 'ctx-bar' })
  Object.assign(ctxBar.style, { left: `${AX0}px`, top: `${AY - 12}px`, width: `${pos(1e7) - AX0}px` })
  L.append(ctxBar)
  gsap.set(ctxBar, { scaleX: 0, transformOrigin: '0% 50%' })
  const marks = CTX.map((c) => {
    const x = pos(c.n)
    const pin = h('div', { class: 'ctx-pin' })
    at(pin, x, AY)
    const v = label(L, c.v, x, AY - 74, { cls: 'ctx-v mono' })
    const who = label(L, c.who, x, AY - 44, { cls: 'ctx-who' })
    L.append(pin)
    return [pin, v, who]
  })
  const ctxTitle = label(L, '上下文窗口：一次能读进多少 token（对数刻度）', AX0, 236, { anchor: 'l', cls: 'axis' })
  const partA = [axis, ...ticks.flat(), ctxBar, ...marks.flat(), ctxTitle]

  // ── 智能体：Claude Code 的一段对话记录 ──
  const lines = [
    h('div', { class: 'tx-think' }, ['✻ ', h('span', { text: 'Thinking…' })]),
    h('div', {}, [h('span', { class: 'tx-dot', text: '⏺ ' }), h('b', { text: 'Read' }), '(attention.py)']),
    h('div', {}, [h('span', { class: 'tx-dot', text: '⏺ ' }), h('b', { text: 'Bash' }), '(pytest -q)']),
    h('div', { class: 'tx-out' }, ['  ⎿  ', h('span', { class: 'seg-k', text: '42 passed' })]),
    h('div', {}, [h('span', { class: 'tx-dot tx-msg', text: '⏺ ' }), h('span', { class: 'tx-zh', text: '修好了！mask 的方向写反了。' })]),
  ]
  const transcript = h('div', { class: 'transcript' }, lines)
  at(transcript, 560, 230)
  L.append(transcript)

  // ── O(n²) ──
  const grid = (n: number, x: number, cell: number) => {
    const g = h('div', { class: 'nsq' })
    g.style.gridTemplateColumns = `repeat(${n}, ${cell}px)`
    for (let i = 0; i < n * n; i++) g.append(h('i'))
    at(g, x, 430)
    L.append(g)
    return g
  }
  const g4 = grid(4, 700, 34)
  const g8 = grid(8, 1260, 34)
  const g4L = label(L, '4 个词：16 次比较', 700, 548, { cls: 'nsq-l' })
  const g8L = label(L, '8 个词：64 次比较', 1260, 620, { cls: 'nsq-l' })
  const x4 = arrow(svg, 840, 430, 1030, 430, { head: 12, color: C.dim })
  const x4L = label(L, '长度 ×2，计算 ×4', 935, 396, { cls: 'nsq-x seg-o' })
  const partC = [g4, g8, g4L, g8L, x4L]

  // ── 研究方向 ──
  const ideas = [
    ['FlashAttention', 520, 300],
    ['稀疏注意力', 1000, 240],
    ['线性注意力', 1420, 330],
    ['状态空间模型', 700, 480],
    ['混合专家 MoE', 1200, 520],
  ].map(([t, x, y]) => chip(L, t as string, x as number, y as number, { cls: (t as string).match(/[A-Za-z]/) ? 'mono idea' : 'idea' }))

  // ── 核心配方：注意力 + 前馈，一层层叠上去 ──
  const stack = Array.from({ length: 8 }, (_, i) => {
    const row = h('div', { class: 'stack-row' }, [h('span', { class: 'sr-a', text: '注意力' }), h('span', { class: 'sr-f', text: '前馈网络' })])
    at(row, STAGE_CX, 690 - i * 58)
    L.append(row)
    return row
  })
  const stackL = label(L, '2017 → 2026', STAGE_CX + 300, 480, { anchor: 'l', cls: 'stack-l mono' })

  // ── 片尾 ──
  const thanks = h('div', { class: 'thanks' }, ['感谢你的 ', h('span', { class: 'lat seg-o', text: 'Attention' })])
  at(thanks, STAGE_CX, 330)
  const cite = h('div', { class: 'cite', text: 'Attention Is All You Need. Vaswani et al., 2017' })
  at(cite, STAGE_CX, 410)
  const shell = at(
    h('div', { class: 'shell' }, [h('span', { class: 'sh-path', text: '~/transformer-history' }), h('span', { class: 'sh-arrow', text: ' ❯ ' }), h('span', { class: 'cursor' })]),
    MARGIN,
    HEADING_Y,
  )
  L.append(thanks, cite, shell)

  hide(partA, transcript, lines, partC, ideas, stack, stackL, thanks, cite, shell)

  d.chapter({
    id: 'now',
    title: '今天与明天',
    year: '2026',
    question: '现在发展到哪一步了？',
    verb: 'Looking ahead',
    banner: '2026',
    layer: L,
  })

  d.say('这几年，上下文窗口从几百个 token，一路涨到了上百万个。', (t) => {
    fadeIn(tl, [axis, ...ticks.flat(), ctxTitle, ctxBar], t + 0.2, { y: 0 })
    CTX.forEach((c, i) => {
      const s0 = t + 0.8 + i * 0.75
      tl.to(ctxBar, { scaleX: (pos(c.n) - AX0) / (pos(1e7) - AX0), duration: 0.6, ease: 'power2.out' }, s0)
      popIn(tl, marks[i], s0 + 0.4, { stagger: 0.06 })
      sfx.at(s0 + 0.4, 'tick', i)
    })
  })

  d.say('模型学会了先“想一想”再回答，还能看图、写代码、调用工具，就像我在终端里帮你干活。', (t) => {
    fadeOut(tl, partA, t + 0.1)
    fadeIn(tl, transcript, t + 0.4, { y: 0 })
    lines.forEach((ln, i) => fadeIn(tl, ln, t + 0.6 + i * 0.6, { y: 6 }))
    clawd.face(tl, 'happy', t + 3.6)
    clawd.face(tl, 'normal', t + 5.2)
  })

  d.say('当然也有烦恼：注意力要让每个词两两相看，长度翻一倍，计算量就翻四倍。', (t) => {
    fadeOut(tl, transcript, t + 0.1)
    popIn(tl, g4, t + 0.5)
    fadeIn(tl, g4L, t + 0.7)
    drawArrow(tl, x4, t + 1.3, 0.4)
    fadeIn(tl, x4L, t + 1.5)
    popIn(tl, g8, t + 1.8)
    fadeIn(tl, g8L, t + 2.0)
    clawd.prop(tl, 'sweat', t + 2.4, 2)
  })

  d.say('所以研究者们还在不停地改进它，也在尝试全新的架构。', (t) => {
    fadeOut(tl, [...partC, x4.path, x4.head], t + 0.1)
    popIn(tl, ideas, t + 0.5, { stagger: 0.22 })
    ideas.forEach((_, i) => sfx.at(t + 0.5 + i * 0.22, 'pop'))
  })

  d.say('但从 2017 年到今天，核心配方几乎没变：注意力加前馈网络，一层一层往上叠。', (t) => {
    fadeOut(tl, ideas, t + 0.1, { stagger: 0.04 })
    stack.forEach((row, i) => {
      tl.fromTo(row, { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'bounce.out', immediateRender: false }, t + 0.6 + i * 0.22)
      sfx.at(t + 0.75 + i * 0.22, 'tick', i)
    })
    fadeIn(tl, stackL, t + 2.6)
  })

  d.say('下一个突破会是什么？说不定，就藏在正在看视频的你的脑子里。', (t) => {
    fadeOut(tl, [...stack, stackL], t + 0.2, { stagger: 0.03 })
    clawd.look(tl, 'u', t + 1.2)
    clawd.look(tl, 'c', t + 2.6)
    clawd.face(tl, 'happy', t + 2.8)
    clawd.face(tl, 'normal', t + 4.4)
  })

  d.say('Attention is all you need。也谢谢你的 attention，我们下次见！', (t) => {
    clawd.wave(tl, t + 0.4, 6)
    clawd.prop(tl, 'heart', t + 1.2, 2.4)
  })

  // ── /exit：回到 shell，迷你 Clawd 说再见 ──
  d.hush()
  let t = d.t + 0.2
  clawd.look(tl, 'd', t)
  t = term.ask(tl, '/exit', t)
  clawd.look(tl, 'c', t)
  // 等 "> /exit" 的淡入（0.35s，从 ask 内部 submit+0.04 开始）走完再淡出：
  // 两个 tween 若重叠，淡入的收尾渲染会盖掉淡出，标题会一直留在片尾卡上压住 shell 提示符。
  term.clearHeading(tl, t + 0.45)
  tl.to([term.rulerEl, term.prompt, term.footerEl], { autoAlpha: 0, duration: 0.5, stagger: 0.06 }, t + 0.2)
  t = clawd.hopTo(tl, STAGE_CX, 650, t + 0.3, { dur: 0.7, height: 160, scale: 10 / CLAWD_PX })
  sfx.at(t - 0.39, 'thud')
  d.cue('land', t - 0.39)
  fadeIn(tl, thanks, t + 0.1, { y: 16 })
  fadeIn(tl, cite, t + 0.6, { y: 8 })
  set(tl, shell, { autoAlpha: 1 }, t + 0.8)
  clawd.wave(tl, t + 1.0, 4)
  clawd.face(tl, 'happy', t + 1.0)
  d.t = t + 4.2
}
