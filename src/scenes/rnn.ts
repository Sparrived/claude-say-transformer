import { gsap } from 'gsap'
import type { Director } from '../director'
import { h, hide, set } from '../lib/dom'
import { C } from '../lib/colors'
import { arrow, box, chip, drawArrow, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

export const SENTENCE = ['小猫', '没有', '过', '马路', '因为', '它', '太', '累', '了']
const IT = 5 // “它”

/** 记忆里各个词所占的比例（示意）。RNN：每读一个新词，旧内容就被冲淡一半 */
function rnnMemory(k: number) {
  const w = SENTENCE.map((_, i) => (i <= k ? 0.5 ** (k - i) : 0))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / sum)
}
/** LSTM：遗忘门学会了把主语“小猫”留住 */
function lstmMemory(k: number) {
  const w = SENTENCE.map((_, i) => (i > k ? 0 : i === 0 ? 1.2 : 0.7 ** (k - i)))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / sum)
}

export function rnn(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('rnn')
  const svg = fx(L)
  const X = (i: number) => 240 + i * 180
  const TOK_Y = 664
  const CELL_Y = 500
  const MEM_Y = 352
  const BAR_W = 300

  const toks = SENTENCE.map((w, i) => chip(L, w, X(i), TOK_Y, { w: 112 }))
  const cells = SENTENCE.map((_, i) => {
    const el = box(L, X(i), CELL_Y, 128, 80, { cls: 'cell' })
    el.append(h('span', { class: 'cell-a', text: 'RNN' }), h('span', { class: 'cell-b', text: 'LSTM' }))
    return el
  })
  const gates = cells.map((c) => {
    const g = h('div', { class: 'gates' }, [h('i'), h('i'), h('i')])
    c.append(g)
    return g
  })
  const up = SENTENCE.map((_, i) => arrow(svg, X(i), TOK_Y - 38, X(i), CELL_Y + 44, { head: 10 }))
  const right = SENTENCE.slice(1).map((_, i) => arrow(svg, X(i) + 66, CELL_Y, X(i + 1) - 66, CELL_Y, { head: 10 }))

  // “记忆”条：每一段代表一个词在记忆里还剩多少，橙色那段是“小猫”
  const segs = SENTENCE.map((_, i) => {
    const sg = h('div', { class: 'mem-seg' })
    sg.style.background = i === 0 ? C.clawd : i % 2 ? '#77726A' : '#5C5852'
    return sg
  })
  const share = h('div', { class: 'mem-share', text: '小猫 2%' })
  const memTitle = h('div', { class: 'mem-title', text: '记忆' })
  const bar = h('div', { class: 'mem-bar' }, [memTitle, ...segs, share])
  Object.assign(bar.style, { left: `${X(0)}px`, top: `${MEM_Y}px`, width: `${BAR_W}px` })
  L.append(bar)
  gsap.set(segs, { width: 0 })

  const ask = label(L, '?', X(IT) + 58, TOK_Y - 44, { cls: 'ask-badge' })
  const stepCount = label(L, '', 1700, CELL_Y - 92, { cls: 'step-count mono', anchor: 'r' })

  // GPU：一排排计算核心
  const cores = Array.from({ length: 64 }, () => h('i'))
  const gpu = h('div', { class: 'gpu' }, [h('div', { class: 'gpu-name', text: 'GPU' }), h('div', { class: 'gpu-grid' }, cores)])
  Object.assign(gpu.style, { left: `${1180}px`, top: `${178}px` })
  const gpuNote = label(L, '同一时刻，只有 1 个核心在干活', 1180, 300, { anchor: 'l', cls: 'gpu-note' })
  L.append(gpu)

  hide(toks, cells, bar, share, ask, stepCount, gpu, gpuNote, gates, cells.map((c) => c.querySelector('.cell-b')))

  /** 依次读入第 from..to 个词 */
  const read = (t: number, from: number, to: number, memory: (k: number) => number[], stepDur: number, drawArrows: boolean) => {
    for (let k = from; k <= to; k++) {
      const s0 = t + (k - from) * stepDur
      if (k > from) {
        tl.to([toks[k - 1], cells[k - 1]], { borderColor: C.line, duration: 0.15 }, s0)
        tl.to(bar, { x: X(k) - X(0), duration: stepDur * 0.6, ease: 'power2.inOut' }, s0)
        if (drawArrows) drawArrow(tl, right[k - 1], s0, stepDur * 0.4)
      }
      tl.to([toks[k], cells[k]], { borderColor: C.clawd, duration: 0.15 }, s0)
      if (drawArrows) drawArrow(tl, up[k], s0, stepDur * 0.35)
      const m = memory(k)
      segs.forEach((sg, i) => tl.to(sg, { width: m[i] * BAR_W, duration: stepDur * 0.6, ease: 'power2.out' }, s0 + 0.05))
      sfx.at(s0, 'tick', k)
    }
    return t + (to - from + 1) * stepDur
  }

  d.chapter({
    id: 'rnn',
    title: 'RNN：一个词一个词地读',
    year: '1990s',
    question: 'Transformer 出现以前，机器是怎么读句子的？',
    verb: 'Rewinding',
    banner: 'RNN',
    layer: L,
  })

  d.say('在 Transformer 出现之前，读句子的主角是 {o:RNN}，循环神经网络。', (t) => {
    popIn(tl, toks, t + 0.6, { stagger: 0.05 })
    popIn(tl, cells, t + 1.1, { stagger: 0.05 })
  })

  d.say('它像我们一样，一个词一个词地读，把读到的内容压进一份“记忆”，传给下一步。', (t) => {
    fadeIn(tl, bar, t + 0.4)
    read(t + 0.6, 0, IT, rnnMemory, 0.62, true)
  })

  d.say('可记忆的容量有限。读到“它”的时候，“小猫”只剩下一丁点儿了。', (t) => {
    fadeIn(tl, share, t + 0.5, { y: 6 })
    tl.to(segs[0], { backgroundColor: C.clawdHi, duration: 0.2, repeat: 3, yoyo: true }, t + 0.6)
  })

  d.say('那“它”到底指的是谁？模型已经想不起来了。', (t) => {
    popIn(tl, ask, t + 0.3)
    clawd.prop(tl, 'ask', t + 0.4, 2.4)
    clawd.shake(tl, t + 0.5)
  })

  d.say('1997 年，{o:LSTM} 给记忆装上了几道“门”，学会了该记住什么、该忘掉什么。', (t) => {
    fadeOut(tl, [ask, share], t + 0.2)
    const swap = t + 0.8
    cells.forEach((c, i) => {
      tl.to(c.querySelector('.cell-a'), { autoAlpha: 0, duration: 0.2 }, swap + i * 0.05)
      tl.to(c.querySelector('.cell-b'), { autoAlpha: 1, duration: 0.2 }, swap + i * 0.05)
    })
    popIn(tl, gates, swap + 0.3, { stagger: 0.05 })
    // 用 LSTM 重新读一遍：“小猫”留下来的多得多
    const again = swap + 1.0
    tl.to(bar, { x: 0, duration: 0.3, ease: 'power2.inOut' }, again - 0.35)
    tl.to(toks.concat(cells), { borderColor: C.line, duration: 0.15 }, again - 0.35)
    set(tl, share, { textContent: '小猫 30%' }, again)
    read(again, 0, IT, lstmMemory, 0.34, false)
    fadeIn(tl, share, again + 6 * 0.34, { y: 6 })
  })
  clawd.face(tl, 'happy', d.t - 1.2)
  clawd.face(tl, 'normal', d.t + 0.4)

  d.say('但不管 RNN 还是 LSTM，都只能排着队，一步一步地算。', (t) => {
    fadeOut(tl, share, t + 0.1)
    tl.to(toks.concat(cells), { borderColor: C.line, duration: 0.15 }, t + 0.1)
    tl.to(bar, { autoAlpha: 0, duration: 0.3 }, t + 0.1)
    set(tl, stepCount, { autoAlpha: 1 }, t + 0.5)
    cells.forEach((c, i) => {
      const s0 = t + 0.5 + i * 0.3
      tl.to(c, { borderColor: C.clawd, backgroundColor: 'rgba(215,119,87,0.16)', duration: 0.12 }, s0)
      if (i > 0) tl.to(cells[i - 1], { borderColor: C.line, backgroundColor: 'rgba(0,0,0,0)', duration: 0.2 }, s0)
      set(tl, stepCount, { textContent: `第 ${i + 1} 步，共 ${SENTENCE.length} 步` }, s0)
      sfx.at(s0, 'tick', i)
    })
  })

  d.say('句子越长就越慢。GPU 上成千上万个计算核心，大多只能干等着。', (t) => {
    fadeIn(tl, [gpu, gpuNote], t + 0.3, { stagger: 0.15 })
    cores.forEach((c, i) => {
      set(tl, c, { backgroundColor: C.clawd }, t + 0.8 + i * 0.07)
      set(tl, c, { backgroundColor: C.ink3 }, t + 0.8 + (i + 1) * 0.07)
    })
    clawd.prop(tl, 'sweat', t + 1.2, 3)
  })

  d.end(L)
}
