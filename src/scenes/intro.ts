import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, set } from '../lib/dom'
import { C } from '../lib/colors'
import { CLAWD_HOME, CLAWD_PX, HEADING_Y, MARGIN, STAGE_CX, STAGE_CY } from '../layout'
import { createBanner, hideBanner, revealBanner } from '../ui/banner'

/** 开场：在终端里敲下 claude，Clawd 从欢迎框里跳出来 */
export function intro(d: Director) {
  const { tl, clawd, term, sfx } = d
  const L = d.layer('intro')
  gsap.set(L, { autoAlpha: 1 })

  // 终端里的 shell 提示符
  const typed = [...'claude'].map((c) => h('span', { text: c }))
  const shell = at(
    h('div', { class: 'shell' }, [
      h('span', { class: 'sh-path', text: '~/transformer-history' }),
      h('span', { class: 'sh-arrow', text: ' ❯ ' }),
      ...typed,
      h('span', { class: 'cursor sh-cursor' }),
    ]),
    MARGIN,
    HEADING_Y,
  )
  gsap.set(typed, { display: 'none' })

  // Claude Code 的欢迎框
  const welcome = h('div', { class: 'welcome' }, [
    h('div', { class: 'welcome-title', text: ' Claude Code ' }),
    h('div', { class: 'welcome-hi', text: 'Welcome back!' }),
    h('div', { class: 'welcome-meta' }, [h('div', { text: 'Opus 5.5' }), h('div', { text: '~/transformer-history' })]),
  ])
  const WB = { w: 760, h: 420 }
  at(welcome, STAGE_CX - WB.w / 2, STAGE_CY - WB.h / 2 - 10)
  Object.assign(welcome.style, { width: `${WB.w}px`, height: `${WB.h}px` })
  hide(welcome)

  // 片名卡
  const title = createBanner('TRANSFORMER', { cell: 16, color: C.clawd })
  at(title.el, STAGE_CX - title.width / 2, STAGE_CY - 150)
  const sub = h('div', { class: 'title-sub', text: '的前世今生' })
  at(sub, STAGE_CX, STAGE_CY + 76)
  hide(sub)

  L.append(shell, welcome, title.el, sub)

  // 一开始只有 shell；Claude Code 的界面和 Clawd 都还没出现
  hide(term.rulerEl, term.prompt, term.footerEl, clawd.root)
  d.chapter({ id: 'intro', title: '开场', year: '2026' })

  // ── 敲下 claude ──
  let t = 0.8
  typed.forEach((c, i) => {
    set(tl, c, { display: 'inline' }, t + i * 0.09)
    sfx.at(t + i * 0.09, 'key', i)
  })
  t += typed.length * 0.09 + 0.35
  sfx.at(t, 'enter')
  set(tl, shell.querySelector('.sh-cursor')!, { autoAlpha: 0 }, t)

  // ── 欢迎框 + 迷你 Clawd ──
  t += 0.25
  tl.fromTo(welcome, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, t)
  // 迷你版：一个精灵像素只有 6 个舞台像素，像终端里那么小
  clawd.place(tl, STAGE_CX, STAGE_CY + 46, t, 6 / CLAWD_PX)
  tl.fromTo(clawd.root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, t + 0.2)
  sfx.at(t + 0.2, 'pop')
  tl.to([term.rulerEl, term.prompt, term.footerEl], { autoAlpha: 1, duration: 0.4, stagger: 0.08 }, t + 0.3)

  // 东张西望
  clawd.look(tl, 'l', t + 1.1)
  clawd.look(tl, 'r', t + 1.6)
  clawd.look(tl, 'c', t + 2.1)
  clawd.blink(tl, t + 2.3)

  // ── 观众提问 ──
  t += 2.6
  tl.to(shell, { autoAlpha: 0, duration: 0.25 }, t)
  clawd.look(tl, 'd', t)
  t = term.ask(tl, '你是谁？', t)
  clawd.look(tl, 'u', t)
  t = term.think(tl, t, 0.9, 'Waking up')
  clawd.look(tl, 'c', t)

  // ── 跳出欢迎框，落到输入框上 ──
  clawd.face(tl, 'wide', t)
  t = clawd.hopTo(tl, CLAWD_HOME.x, CLAWD_HOME.y, t + 0.1, { dur: 0.75, height: 220, scale: 1 })
  sfx.at(t - 0.39, 'thud')
  d.cue('hop', t - 0.39)
  tl.to(welcome, { autoAlpha: 0, scale: 0.94, duration: 0.3, ease: 'power2.in' }, t - 0.8)
  clawd.face(tl, 'normal', t)
  d.t = t + 0.15

  d.say(
    '嗨！我是 {o:Clawd}，住在 Claude Code 终端里的那只橙色小家伙。',
    (s) => {
      clawd.wave(tl, s + 0.2, 4)
    },
  )
  d.say('今天想和你聊聊 —— Transformer 的前世今生。', (s) => {
    sfx.at(s + 0.6, 'whoosh')
    revealBanner(tl, title, s + 0.6, 1.0)
    d.cue('title', s + 1.6)
    tl.fromTo(sub, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, s + 1.5)
  })
  d.say('Claude 的“大脑”就是一个 Transformer。所以，这也算是在讲我家的家谱。', (s) => {
    clawd.face(tl, 'happy', s + 0.3)
    clawd.prop(tl, 'heart', s + 0.5, 2.2)
    clawd.face(tl, 'normal', s + 3.2)
  })
  d.say('不过故事得从它出生之前讲起……', (s) => {
    clawd.look(tl, 'l', s + 0.4)
    hideBanner(tl, title, s + 1.2, 0.5)
    tl.to(sub, { autoAlpha: 0, duration: 0.4 }, s + 1.3)
    clawd.look(tl, 'c', s + 2.2)
  })
  d.end(L, 0.3)
}
