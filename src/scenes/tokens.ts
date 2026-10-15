import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { CLAWD_EYE, CLAWD_ORANGE, SPRITE, SPRITE_H, SPRITE_W } from '../clawd/sprite'
import { arrow, box, drawArrow, fadeIn, fx, label, popIn } from '../lib/viz'

const PX = 22 // 这张“照片”里每个精灵像素的大小
const PW = 4 // 每块 patch 4×5 个像素
const PH = 5

/** 把 Clawd 的点阵画成 SVG（可以只取其中一块） */
function spriteSvg(vx: number, vy: number, vw: number, vh: number, scale: number) {
  const svg = s('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw * scale, height: vh * scale, 'shape-rendering': 'crispEdges' })
  svg.append(s('rect', { x: 0, y: 0, width: SPRITE_W, height: SPRITE_H, fill: '#2C2A27' }))
  SPRITE.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') svg.append(s('rect', { x, y, width: 1, height: 1, fill: CLAWD_ORANGE }))
    }),
  )
  // 眼睛
  svg.append(s('rect', { x: 4, y: 2, width: 1, height: 2, fill: CLAWD_EYE }), s('rect', { x: 11, y: 2, width: 1, height: 2, fill: CLAWD_EYE }))
  return svg
}

/** 2020+：图片、声音、蛋白质、视频，统统变成 token */
export function tokens(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('tokens')
  const svg = fx(L)

  // 一张 Clawd 的“照片”
  const IMG_X = 210
  const IMG_Y = 196
  const photo = h('div', { class: 'photo' }, [spriteSvg(0, 0, SPRITE_W, SPRITE_H, PX)])
  at(photo, IMG_X, IMG_Y)
  L.append(photo)
  const gridLines = [1, 2, 3].map((c) => s('line', { x1: IMG_X + c * PW * PX, y1: IMG_Y, x2: IMG_X + c * PW * PX, y2: IMG_Y + SPRITE_H * PX, stroke: C.fg, 'stroke-width': 2, 'stroke-dasharray': '6 5' }))
  gridLines.push(s('line', { x1: IMG_X, y1: IMG_Y + PH * PX, x2: IMG_X + SPRITE_W * PX, y2: IMG_Y + PH * PX, stroke: C.fg, 'stroke-width': 2, 'stroke-dasharray': '6 5' }))
  svg.append(...gridLines)

  // 8 块 patch：先叠在原位，再排成一行
  const patches = Array.from({ length: 8 }, (_, k) => {
    const c = k % 4
    const r = Math.floor(k / 4)
    const el = h('div', { class: 'patch' }, [spriteSvg(c * PW, r * PH, PW, PH, PX)])
    at(el, IMG_X + c * PW * PX, IMG_Y + r * PH * PX)
    const idx = h('span', { class: 'patch-i mono', text: String(k + 1) })
    el.append(idx)
    L.append(el)
    return { el, idx, c, r }
  })
  const ROW_Y = 236
  const rowX = (k: number) => 720 + k * 104
  const tf = box(L, 1700, 270, 220, 96, { cls: 'tf-box', text: 'Transformer' })
  const into = arrow(svg, rowX(7) + 72, 270, 1584, 270, { head: 12, color: C.dim })
  const imgL = label(L, '图片 → 小方块', 1110, 378, { cls: 'mod-l' })

  // 声音 / 蛋白质 / 视频
  const MODS = [
    { name: '声音', color: C.teal, y: 520 },
    { name: '蛋白质', color: C.k, y: 610 },
    { name: '视频', color: C.purple, y: 700 },
  ]
  const wave = (() => {
    let dd = ''
    for (let x = 0; x <= 200; x += 4) dd += `${x ? 'L' : 'M'}${330 + x},${520 + Math.sin(x / 7) * Math.sin(x / 31) * 26}`
    return s('path', { d: dd, fill: 'none', stroke: C.teal, 'stroke-width': 3 })
  })()
  const chain = s(
    'g',
    {},
    Array.from({ length: 7 }, (_, i) => s('circle', { cx: 340 + i * 30, cy: 610 + (i % 2 ? -8 : 8), r: 11, fill: 'none', stroke: C.k, 'stroke-width': 3 })),
  )
  const frames = s(
    'g',
    {},
    [0, 1, 2].map((i) => s('rect', { x: 350 + i * 22, y: 680 - i * 8, width: 110, height: 52, fill: C.ink2, stroke: C.purple, 'stroke-width': 3 })),
  )
  svg.append(wave, chain, frames)
  const modRows = MODS.map((m) => {
    const name = label(L, m.name, 300, m.y, { anchor: 'r', cls: 'mod-name' })
    const toks = Array.from({ length: 8 }, (_, k) => {
      const t = h('i', { class: 'mtok' })
      t.style.borderColor = m.color
      t.style.background = `color-mix(in srgb, ${m.color} ${30 + ((k * 37) % 50)}%, transparent)`
      at(t, rowX(k) + 8, m.y - 22)
      L.append(t)
      return t
    })
    const a = arrow(svg, rowX(7) + 72, m.y, 1650, 324, { head: 10, color: m.color, bend: -30 })
    return { name, toks, a }
  })
  const icons = [wave, chain, frames]
  const motto = label(L, '万物皆可 token', 1700, 192, { cls: 'motto seg-o' })

  hide(photo, gridLines, patches.map((p) => p.el), patches.map((p) => p.idx), tf, imgL, icons, motto, modRows.flatMap((m) => [m.name, ...m.toks]))

  d.chapter({
    id: 'tokens',
    title: '万物皆可 token',
    year: '2020',
    question: 'Transformer 只能处理文字吗？',
    verb: 'Tokenizing',
    banner: 'TOKENS',
    color: C.purple,
    layer: L,
  })

  d.say('当然不止！2020 年的 ViT 把图片切成一个个小方块，每块都当成一个“词”。', (t) => {
    popIn(tl, photo, t + 0.4)
    fadeIn(tl, gridLines, t + 1.4, { y: 0, stagger: 0.12 })
    popIn(tl, tf, t + 1.0)
  })

  d.say('比如……把我切成 8 块。放心，不疼。', (t) => {
    clawd.face(tl, 'wide', t + 0.3)
    clawd.prop(tl, 'sweat', t + 0.3, 2.2)
    set(tl, patches.map((p) => p.el), { autoAlpha: 1 }, t + 0.8)
    set(tl, photo, { autoAlpha: 0 }, t + 0.8)
    tl.to(gridLines, { autoAlpha: 0, duration: 0.2 }, t + 0.8)
    patches.forEach((p, k) => {
      tl.to(p.el, {
        x: rowX(k) - (IMG_X + p.c * PW * PX),
        y: ROW_Y - (IMG_Y + p.r * PH * PX),
        scale: 0.62,
        duration: 0.6,
        ease: 'power3.inOut',
      }, t + 1.0 + k * 0.1)
      sfx.at(t + 1.0 + k * 0.1, 'tick', k)
    })
    fadeIn(tl, patches.map((p) => p.idx), t + 2.0, { stagger: 0.05, y: 4 })
    drawArrow(tl, into, t + 2.3, 0.4)
    fadeIn(tl, imgL, t + 2.4)
    clawd.face(tl, 'happy', t + 2.6)
    clawd.face(tl, 'normal', t + 4.2)
  })

  d.say('声音可以切成小片段，蛋白质可以拆成氨基酸，视频可以切成时空小块。', (t) => {
    modRows.forEach((m, i) => {
      const s0 = t + 0.4 + i * 1.1
      fadeIn(tl, [m.name, icons[i]], s0, { y: 0 })
      popIn(tl, m.toks, s0 + 0.4, { stagger: 0.04 })
      drawArrow(tl, m.a, s0 + 0.8, 0.4)
    })
  })

  d.say('只要能变成一串 token，Transformer 就能处理。注意力，成了 AI 的通用积木。', (t) => {
    tl.to(tf, { borderColor: C.clawd, color: C.clawd, scale: 1.08, duration: 0.4, ease: 'back.out(2)' }, t + 0.5)
    fadeIn(tl, motto, t + 0.9)
    sfx.at(t + 0.9, 'ding')
  })

  d.end(L)
}
