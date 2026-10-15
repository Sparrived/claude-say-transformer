import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C, mix } from '../lib/colors'
import { box, chip, fadeIn, fadeOut, fx, label, popIn } from '../lib/viz'

// 位置编码：几条频率不同的正弦波
const WAVE_X0 = 1000
const WAVE_X1 = 1800
const PERIODS = [120, 240, 480, 960]
const WAVE_Y = [252, 334, 416, 498]
const SAMPLE_X = [1100, 1300, 1500]
const pe = (pos: number, k: number) => Math.sin((2 * Math.PI * (SAMPLE_X[pos] - WAVE_X0)) / PERIODS[k])

// 8 个注意力头各自的“看法”（6×6 示意矩阵）
const N = 6
const HEADS: { name: string; color: string; f: (i: number, j: number) => number }[] = [
  { name: '看前一个词', color: C.q, f: (i, j) => (j === i - 1 || (i === 0 && j === 0) ? 1 : 0.04) },
  { name: '看后一个词', color: C.k, f: (i, j) => (j === i + 1 || (i === N - 1 && j === i) ? 1 : 0.04) },
  { name: '找指代', color: C.clawd, f: (i, j) => (i === 4 && j === 0 ? 1 : i === j ? 0.3 : 0.04) },
  { name: '看句子开头', color: C.purple, f: (_, j) => (j === 0 ? 0.9 : 0.06) },
  { name: '看自己', color: C.teal, f: (i, j) => (i === j ? 0.9 : 0.05) },
  { name: '看句子结构', color: C.v, f: (i, j) => ((i < 3) === (j < 3) ? 0.55 : 0.04) },
  { name: '雨露均沾', color: C.pink, f: () => 0.3 },
  { name: '看标点', color: C.red, f: (_, j) => (j === N - 1 ? 0.9 : 0.06) },
]

export function parallel(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('parallel')
  const svg = fx(L)

  // ── A：RNN 排队 vs Transformer 并行 ──
  const LANE = [262, 420]
  const cx = (i: number) => 360 + i * 92
  const laneL = ['RNN', 'Transformer'].map((n, k) => label(L, n, 96, LANE[k], { anchor: 'l', cls: 'lane-l mono' }))
  const lanes = LANE.map((y) => Array.from({ length: 9 }, (_, i) => box(L, cx(i), y, 72, 56, { cls: 'pcell' })))
  const timers = LANE.map((y) => label(L, '', cx(8) + 70, y, { anchor: 'l', cls: 'timer mono' }))
  const cores = Array.from({ length: 64 }, () => h('i'))
  const gpu = h('div', { class: 'gpu' }, [h('div', { class: 'gpu-name', text: 'GPU' }), h('div', { class: 'gpu-grid' }, cores)])
  at(gpu, 1300, 286)
  const gpuNote = label(L, '所有核心一起开工', 1388, 420, { anchor: 'l', cls: 'gpu-note seg-k' })
  L.append(gpu)
  const partA = [...laneL, ...lanes.flat(), ...timers, gpu, gpuNote]

  // ── B：位置编码 ──
  const ROWS = [
    ['猫', '追', '狗'],
    ['狗', '追', '猫'],
  ]
  const RY = [292, 520]
  const rx = (i: number) => 200 + i * 140
  const rowChips = ROWS.map((row, r) => row.map((w, i) => chip(L, w, rx(i), RY[r], { w: 100 })))
  const same = label(L, '在它眼里一样', 600, 406, { anchor: 'l', cls: 'verdict seg-d' })
  const diff = label(L, '现在不一样了', 600, 406, { anchor: 'l', cls: 'verdict seg-k' })
  const waves = PERIODS.map((p, k) => {
    let dd = ''
    for (let x = WAVE_X0; x <= WAVE_X1; x += 4) dd += `${x === WAVE_X0 ? 'M' : 'L'}${x},${(WAVE_Y[k] - 28 * Math.sin((2 * Math.PI * (x - WAVE_X0)) / p)).toFixed(1)}`
    const path = s('path', { d: dd, fill: 'none', stroke: mix(C.clawd, C.v, k / 3), 'stroke-width': 3 })
    svg.append(path)
    gsap.set(path, { drawSVG: '0%' })
    return path
  })
  const samples = SAMPLE_X.map((x, pos) => {
    const line = s('line', { x1: x, y1: 206, x2: x, y2: 540, stroke: C.dim, 'stroke-width': 2, 'stroke-dasharray': '6 6' })
    const dots = PERIODS.map((_, k) => s('circle', { cx: x, cy: WAVE_Y[k] - 28 * pe(pos, k), r: 7, fill: C.fg }))
    svg.append(line, ...dots)
    return [line, ...dots]
  })
  const posL = SAMPLE_X.map((x, pos) => label(L, `位置 ${pos + 1}`, x, 574, { cls: 'pos-l mono' }))
  const waveNote = label(L, '频率不同的正弦波', WAVE_X1, 200, { anchor: 'r', cls: 'axis' })
  // 每个位置一枚“印章”：四条波在这里的取值
  const stamp = (pos: number) => {
    const el = h(
      'div',
      { class: 'stamp' },
      PERIODS.map((_, k) => {
        const c = h('i')
        c.style.background = mix(C.ink3, C.clawd, (pe(pos, k) + 1) / 2)
        return c
      }),
    )
    L.append(el)
    return el
  }
  const stamps = ROWS.map((row, r) => row.map((_, i) => at(stamp(i), rx(i), RY[r] + 52)))
  const partB = [...rowChips.flat(), same, diff, ...posL, waveNote, ...stamps.flat()]

  // ── C：多头注意力 ──
  const heads = HEADS.map((hd, k) => {
    const grid = h('div', { class: 'head' })
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const c = h('i')
        c.style.background = mix(C.ink2, hd.color, hd.f(i, j))
        grid.append(c)
      }
    const x = 420 + (k % 4) * 360
    const y = k < 4 ? 268 : 530
    at(grid, x, y)
    const name = label(L, hd.name, x, y + 102, { cls: 'head-l' })
    const tag = label(L, `头 ${k + 1}`, x - 71, y - 90, { anchor: 'l', cls: 'head-tag mono' })
    tag.style.color = hd.color
    L.append(grid)
    return { grid, name, tag }
  })
  const partC = heads.flatMap((x) => [x.grid, x.name, x.tag])

  hide(partA, partB, partC, samples.flat())

  d.chapter({
    id: 'parallel',
    title: '并行、位置编码与多头',
    year: '2017',
    question: '它凭什么比 RNN 快那么多？',
    verb: 'Parallelizing',
    banner: 'PARALLEL',
    color: C.teal,
    layer: L,
  })

  d.say('RNN 得一步一步地算；Transformer 没有循环，所有词可以同时算。', (t) => {
    fadeIn(tl, [...laneL, ...lanes.flat()], t + 0.2, { y: 0 })
    const go = t + 1.3
    lanes[0].forEach((c, i) => {
      tl.to(c, { backgroundColor: C.clawd, borderColor: C.clawd, duration: 0.1 }, go + i * 0.32)
      set(tl, timers[0], { autoAlpha: 1, textContent: `${i + 1} 步` }, go + i * 0.32)
      sfx.at(go + i * 0.32, 'tick', i)
    })
    tl.to(lanes[1], { backgroundColor: C.teal, borderColor: C.teal, duration: 0.15 }, go)
    set(tl, timers[1], { autoAlpha: 1, textContent: '1 步' }, go)
    sfx.at(go, 'ding')
  })

  d.say('这正好喂饱了 GPU 上成千上万个核心，训练一下子快了很多。', (t) => {
    fadeIn(tl, gpu, t + 0.3, { y: 0 })
    tl.to(cores, { backgroundColor: C.teal, duration: 0.05, stagger: { each: 0.004, from: 'random' } }, t + 0.9)
    fadeIn(tl, gpuNote, t + 1.3)
    clawd.face(tl, 'happy', t + 1.2)
    clawd.face(tl, 'normal', t + 3.4)
  })

  d.say('可同时算也有代价：它分不清顺序。“猫追狗”和“狗追猫”，在它眼里一模一样。', (t) => {
    fadeOut(tl, partA, t + 0.1)
    popIn(tl, rowChips.flat(), t + 0.6, { stagger: 0.05 })
    // 词在原地抖一抖：在它看来，顺序无所谓
    rowChips.forEach((row) => tl.to(row, { y: -10, duration: 0.12, yoyo: true, repeat: 3, stagger: 0.05 }, t + 2.2))
    fadeIn(tl, same, t + 2.8)
    clawd.prop(tl, 'ask', t + 3.0, 1.8)
  })

  d.say('所以要给每个位置加上“位置编码”：用不同频率的正弦波，给每个位置盖一个独一无二的章。', (t) => {
    fadeIn(tl, waveNote, t + 0.3, { y: 0 })
    waves.forEach((p, k) => tl.to(p, { drawSVG: '100%', duration: 1.0, ease: 'power1.inOut' }, t + 0.4 + k * 0.15))
    samples.forEach((grp, pos) => {
      fadeIn(tl, grp, t + 1.8 + pos * 0.3, { y: 0 })
      fadeIn(tl, posL[pos], t + 1.8 + pos * 0.3, { y: 6 })
    })
    stamps.forEach((row) => row.forEach((st, i) => popIn(tl, st, t + 3.1 + i * 0.2)))
    tl.to(same, { autoAlpha: 0, duration: 0.2 }, t + 3.9)
    fadeIn(tl, diff, t + 4.0)
  })

  d.say('注意力也不止一组。原版 Transformer 有 8 个“头”，各看各的。', (t) => {
    fadeOut(tl, [...partB, ...samples.flat(), ...waves], t + 0.1)
    heads.forEach((hd, k) => {
      popIn(tl, hd.grid, t + 0.6 + k * 0.12)
      fadeIn(tl, [hd.tag, hd.name], t + 0.7 + k * 0.12, { y: 6 })
    })
  })

  d.say('有的头盯着相邻的词，有的头专门找指代，有的头关注句子结构。', (t) => {
    const focus = [0, 2, 5]
    heads.forEach((hd, k) => {
      if (!focus.includes(k)) tl.to([hd.grid, hd.name, hd.tag], { opacity: 0.25, duration: 0.3 }, t + 0.3)
    })
    focus.forEach((k, n) => tl.to(heads[k].grid, { scale: 1.12, duration: 0.3, ease: 'back.out(2)' }, t + 0.5 + n * 0.9))
  })

  d.end(L)
}
