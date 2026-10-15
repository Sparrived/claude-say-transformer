import { gsap } from 'gsap'
import type { Director } from '../director'
import { at, h, hide, rand } from '../lib/dom'
import { C } from '../lib/colors'
import { STAGE_CX, STAGE_CY } from '../layout'
import { createBanner, revealBanner } from '../ui/banner'
import { fadeIn } from '../lib/viz'

const AUTHORS = [
  'Ashish Vaswani',
  'Noam Shazeer',
  'Niki Parmar',
  'Jakob Uszkoreit',
  'Llion Jones',
  'Aidan N. Gomez',
  'Łukasz Kaiser',
  'Illia Polosukhin',
]

/** 2017：《Attention Is All You Need》 */
export function paper(d: Director) {
  const { tl, clawd, sfx } = d
  const L = d.layer('paper')

  // 论文首页（排版仿 NeurIPS 论文）
  const hl = h('mark', {
    class: 'hl',
    text: 'based solely on attention mechanisms, dispensing with recurrence and convolutions entirely',
  })
  const title = h('div', { class: 'pp-title', text: 'Attention Is All You Need' })
  const page = h('div', { class: 'paper' }, [
    h('div', { class: 'pp-stamp', text: 'arXiv:1706.03762v1  [cs.CL]  12 Jun 2017' }),
    title,
    h('div', { class: 'pp-authors' }, AUTHORS.map((a) => h('span', { text: `${a}*` }))),
    h('div', { class: 'pp-abs-h', text: 'Abstract' }),
    h('p', { class: 'pp-abs' }, [
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, ',
      hl,
      '. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable…',
    ]),
    h('div', { class: 'pp-foot', text: '*Equal contribution. Listing order is random.' }),
  ])
  at(page, STAGE_CX - 400, 168)
  L.append(page)

  // 旧时代的 RNN：一会儿要被划掉、散架
  const old = createBanner('RNN', { cell: 8, color: C.dim })
  at(old.el, 1500, 380)
  const strike = at(h('div', { class: 'strike' }), 1484, 420)
  L.append(old.el, strike)

  const big = createBanner('TRANSFORMER', { cell: 16, color: C.clawd })
  at(big.el, STAGE_CX - big.width / 2, STAGE_CY - big.height / 2 - 30)
  L.append(big.el)

  hide(page, strike)
  gsap.set(old.cols, { autoAlpha: 1 })
  hide(old.el)
  gsap.set(strike, { scaleX: 0, transformOrigin: '0% 50%' })

  d.chapter({
    id: 'paper',
    title: '2017：Attention Is All You Need',
    year: '2017',
    question: '2017 年发生了什么？',
    verb: 'Reading arXiv',
    layer: L,
  })

  d.say('2017 年 6 月，谷歌的八位研究者在 arXiv 上贴出了一篇论文。', (t) => {
    tl.fromTo(page, { autoAlpha: 0, y: 260, rotation: -4 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.8, ease: 'power3.out', immediateRender: false }, t + 0.3)
    sfx.at(t + 0.3, 'whoosh')
  })

  d.say('标题相当霸气：《Attention Is All You Need》，你只需要注意力。', (t) => {
    tl.fromTo(title, { backgroundSize: '0% 6px' }, { backgroundSize: '100% 6px', duration: 0.8, ease: 'power2.inOut', immediateRender: false }, t + 0.9)
    clawd.face(tl, 'wide', t + 1.0)
    clawd.prop(tl, 'bang', t + 1.0, 1.5)
    clawd.face(tl, 'normal', t + 2.8)
  })

  d.say('他们的主张是：干脆把 RNN 整个扔掉，只用注意力来搭模型。', (t) => {
    tl.fromTo(hl, { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: 1.6, ease: 'none', immediateRender: false }, t + 0.5)
    fadeIn(tl, old.el, t + 1.2, { y: 0 })
    tl.to(strike, { scaleX: 1, duration: 0.3, ease: 'power2.out' }, t + 2.2)
    sfx.at(t + 2.2, 'tick', 3)
    old.cols.forEach((g, i) =>
      tl.to(g, { y: 260 + rand(i) * 120, rotation: (rand(i + 9) - 0.5) * 70, autoAlpha: 0, duration: 0.9, ease: 'power2.in' }, t + 2.7 + i * 0.015),
    )
    tl.to(strike, { autoAlpha: 0, duration: 0.3 }, t + 2.9)
  })

  // 话音未落，片名再次登场
  d.say('这个新模型，名字叫——', (t) => {
    tl.to(page, { autoAlpha: 0, y: -40, scale: 0.9, duration: 0.5, ease: 'power2.in' }, t + 0.6)
    const r = t + 1.3
    sfx.at(r, 'whoosh')
    revealBanner(tl, big, r, 1.1)
    clawd.bounce(tl, r + 1.1, 60)
    clawd.cheer(tl, r + 1.2, 1.2)
    clawd.face(tl, 'happy', r + 1.2)
    sfx.at(r + 1.2, 'ding')
    d.cue('paper-title', r + 1.2)
  }, { hold: 3.2 })

  d.say('顺便一提，这个标题是在致敬披头士的那首《All You Need Is Love》。', (t) => {
    clawd.prop(tl, 'note', t + 0.6, 2.6)
    clawd.face(tl, 'normal', t + 3.4)
    tl.to(big.el, { y: -20, duration: 0.6, ease: 'power1.inOut' }, t)
  })

  d.end(L)
}
