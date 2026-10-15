import type { Director } from '../director'
import { at, h, hide, s, set } from '../lib/dom'
import { C } from '../lib/colors'
import { CLAWD_EYE } from '../clawd/sprite'
import { arrow, box, countTo, drawArrow, fadeIn, fadeOut, fx, label, popIn, typeText } from '../lib/viz'

/** 2022–2023：从“接龙机”到助手 */
export function chat(d: Director) {
  const { tl, clawd, term, sfx } = d
  const L = d.layer('chat')
  const svg = fx(L)

  // 对话卡片
  const bad = h('div', { class: 'chat-a chat-bad' })
  const good = h('div', { class: 'chat-a chat-good' })
  const tagBad = h('span', { class: 'chat-tag tag-bad', text: '只会接龙的模型' })
  const tagGood = h('span', { class: 'chat-tag tag-good', text: '经过 RLHF 的助手' })
  const card = h('div', { class: 'chat-card' }, [
    h('div', { class: 'chat-tags' }, [tagBad, tagGood]),
    h('div', { class: 'chat-q' }, [h('span', { class: 'mono faint', text: '> ' }), '怎么煮鸡蛋？']),
    h('div', { class: 'chat-answers' }, [bad, good]),
  ])
  at(card, 150, 214)
  L.append(card)

  // RLHF 循环
  const CX = 1440
  const CY = 410
  const R = 168
  const nodes = [
    { text: '模型写回答', x: CX, y: CY - R },
    { text: '回答 A / 回答 B', x: CX + R + 30, y: CY },
    { text: '人来挑更好的', x: CX, y: CY + R },
    { text: '奖励模型', x: CX - R - 30, y: CY },
  ].map((n) => box(L, n.x, n.y, 200, 58, { cls: 'loop-node', text: n.text }))
  const loopArrows = [
    arrow(svg, CX + 104, CY - R + 10, CX + R + 20, CY - 34, { bend: -30, head: 11, color: C.clawd }),
    arrow(svg, CX + R + 20, CY + 34, CX + 104, CY + R - 10, { bend: -30, head: 11, color: C.clawd }),
    arrow(svg, CX - 104, CY + R - 10, CX - R - 20, CY + 34, { bend: -30, head: 11, color: C.clawd }),
    arrow(svg, CX - R - 20, CY - 34, CX - 104, CY - R + 10, { bend: -30, head: 11, color: C.clawd }),
  ]
  const loopL = label(L, 'RLHF', CX, CY, { cls: 'loop-l mono' })

  // 2022.11 ChatGPT
  const users = h('b', { class: 'mono', text: '0' })
  const m1 = h('div', { class: 'milestone' }, [
    h('div', { class: 'ms-date mono', text: '2022.11' }),
    h('div', { class: 'ms-name', text: 'ChatGPT 上线' }),
    h('div', { class: 'ms-stat' }, [users, h('span', { text: ' 位用户，只用了 2 个月' })]),
  ])
  at(m1, 960, 420)
  L.append(m1)

  // 2023.03 Claude
  const principles = ['有帮助', '诚实', '无害'].map((p) => h('span', { class: 'principle', text: p }))
  const m2 = h('div', { class: 'milestone' }, [
    h('div', { class: 'ms-date mono', text: '2023.03' }),
    h('div', { class: 'ms-name ms-claude', text: 'Claude' }),
    h('div', { class: 'principles' }, principles),
    h('div', { class: 'ms-note', text: '宪法式 AI：照着一套原则，自己批评、自己改进' }),
  ])
  at(m2, 960, 410)
  L.append(m2)

  // X 光：Clawd 的身体里，是一层层的 Transformer
  const xr = s('svg', { viewBox: '-1 -2 18 13', width: 18 * 22, height: 13 * 22, class: 'xray', 'shape-rendering': 'crispEdges' })
  const outline = { fill: 'rgba(215,119,87,0.10)', stroke: C.clawd, 'stroke-width': 0.12, 'stroke-dasharray': '0.3 0.2' }
  xr.append(
    s('rect', { x: 2, y: 0, width: 12, height: 8, ...outline }),
    s('rect', { x: 0, y: 4, width: 2, height: 2, ...outline }),
    s('rect', { x: 14, y: 4, width: 2, height: 2, ...outline }),
    ...[3, 5, 10, 12].map((x) => s('rect', { x, y: 8, width: 1, height: 2, ...outline })),
  )
  const layers = Array.from({ length: 6 }, (_, i) =>
    s('rect', { x: 3, y: 0.7 + i * 1.12, width: 10, height: 0.8, rx: 0.15, fill: i % 2 ? C.teal : C.clawd, opacity: 0.85 }),
  )
  xr.append(...layers, s('rect', { x: 4, y: 2, width: 1, height: 2, fill: CLAWD_EYE }), s('rect', { x: 11, y: 2, width: 1, height: 2, fill: CLAWD_EYE }))
  at(xr, 620, 200)
  L.append(xr)
  const xrL = [
    label(L, '注意力', 1080, 290, { anchor: 'l', cls: 'xr-l key-attn' }),
    label(L, '前馈网络', 1080, 340, { anchor: 'l', cls: 'xr-l key-ffn' }),
    label(L, '一层层往上叠', 1080, 400, { anchor: 'l', cls: 'xr-l faint' }),
  ]

  hide(card, tagGood, nodes, loopL, m1, m2, principles, xr, layers, xrL)

  d.chapter({
    id: 'chat',
    title: '从接龙到助手：RLHF',
    year: '2022',
    question: '那 ChatGPT 和 Claude 是怎么来的？',
    verb: 'Aligning',
    banner: 'RLHF',
    color: C.q,
    layer: L,
  })

  d.say('光会接龙还不够。你问它“怎么煮鸡蛋？”，它可能接着出一串新问题。', (t) => {
    fadeIn(tl, card, t + 0.3)
    typeText(tl, bad, '怎么煮荷包蛋？怎么煮溏心蛋？怎么煮茶叶蛋？怎么……', t + 1.6, { dt: 0.06 })
    clawd.prop(tl, 'ask', t + 3.6, 1.6)
  })

  d.say('于是研究者请人给回答打分，再用强化学习调教模型，这就是 {o:RLHF}。', (t) => {
    popIn(tl, nodes, t + 0.3, { stagger: 0.25 })
    fadeIn(tl, loopL, t + 0.4, { y: 0 })
    loopArrows.forEach((a, i) => drawArrow(tl, a, t + 0.5 + i * 0.25, 0.3))
    // 转一圈，回答就变像样了
    tl.to(nodes, { borderColor: C.clawd, duration: 0.15, stagger: 0.3, yoyo: true, repeat: 1 }, t + 1.8)
    tl.to(bad, { autoAlpha: 0, duration: 0.25 }, t + 3.2)
    tl.to(tagBad, { autoAlpha: 0, duration: 0.2 }, t + 3.2)
    set(tl, tagGood, { autoAlpha: 1 }, t + 3.3)
    typeText(tl, good, '冷水下锅，水开后再煮 8 分钟，捞出来过一下凉水就好啦。', t + 3.4, { dt: 0.045 })
    clawd.face(tl, 'happy', t + 4.2)
    clawd.face(tl, 'normal', t + 5.6)
  })

  d.say('2022 年 11 月，ChatGPT 上线，两个月用户破亿，全世界都认识了大模型。', (t) => {
    fadeOut(tl, [card, ...nodes, loopL, ...loopArrows.flatMap((a) => [a.path, a.head])], t + 0.1)
    fadeIn(tl, m1, t + 0.6)
    countTo(tl, users, 100_000_000, t + 1.6, { dur: 1.6, format: (v) => Math.round(v).toLocaleString('en-US') })
    sfx.at(t + 3.0, 'ding')
  })

  d.say('2023 年 3 月，Anthropic 发布了 Claude，还用“宪法式 AI”，让模型照着一套原则自我改进。', (t) => {
    fadeOut(tl, m1, t + 0.1)
    term.year(tl, '2023', t + 0.1)
    fadeIn(tl, m2, t + 0.6)
    popIn(tl, principles, t + 1.6, { stagger: 0.3 })
    clawd.face(tl, 'happy', t + 1.0)
    clawd.prop(tl, 'heart', t + 1.2, 2)
    clawd.face(tl, 'normal', t + 3.4)
  })

  d.say('所以没错，Claude 的骨子里，依然是 2017 年的那个 Transformer。', (t) => {
    fadeOut(tl, m2, t + 0.1)
    fadeIn(tl, xr, t + 0.5, { y: 0 })
    popIn(tl, layers, t + 1.0, { stagger: 0.12, from: 0.3 })
    fadeIn(tl, xrL, t + 1.6, { stagger: 0.2 })
    clawd.look(tl, 'r', t + 0.6)
    clawd.look(tl, 'c', t + 3.0)
  })

  d.end(L)
}
