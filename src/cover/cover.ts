import '@fontsource/maple-mono/400.css'
import '@fontsource/maple-mono/600.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/900.css'
import '../styles.css'
import './cover.css'

import { gsap } from 'gsap'
import { h } from '../lib/dom'
import { C } from '../lib/colors'
import { Clawd } from '../clawd/clawd'
import { createBanner } from '../ui/banner'
import { typeset } from '../ui/bubble'

/**
 * 【小克学AI】封面：定格在“提出问题”的那一刻的 Claude Code 终端。
 * 输入框里是钩子问题，Clawd 站在输入框上沿，上面是和片头同款的 ANSI Shadow 大字。
 *
 * 版面按 1920×1200（16:10，B 站封面的比例）设计；?h=1080 时整体缩到 90%、左右留白，得到 16:9 的版本。
 * 底部 16% 不放关键内容：B 站卡片会在那里叠播放数据和时长。
 */
const H = Number(new URLSearchParams(location.search).get('h') ?? 1200)
const DESIGN_H = 1200
const root = document.getElementById('cover')!
root.style.height = `${H}px`

// 左上：系列标签；右上：时长承诺
const top = h('div', { class: 'top' }, [h('div', { class: 'tag', text: '小克学AI' }), h('div', { class: 'badge', text: '7 分钟' })])

// 主角一：ANSI Shadow 的 TRANSFORMER，和片头是同一套矢量字符画
const banner = createBanner('TRANSFORMER', { cell: 17, maxWidth: 1700, color: C.clawd })
gsap.set(banner.cols, { autoAlpha: 1 })
const bannerBox = h('div', { class: 'banner-box' }, [banner.el as unknown as Node])

const title = h('h1', { class: 'title', text: '的前世今生' })

// 输入框：里面是钩子问题
const question = h('span', { class: 'q' })
typeset('Claude 的“大脑”是怎么来的？', question)
const prompt = h('div', { class: 'prompt' }, [
  h('div', { class: 'prompt-line' }, [h('span', { class: 'gt', text: '>' }), question, h('span', { class: 'cursor' })]),
])

// 主角二：Clawd 站在输入框的上沿，直视观众，举起右手打招呼。
// 它的辨识度来自“身体两侧中段各一个小突起 + 竖长的眼睛”，所以只抬一只手，保住这个轮廓
const actors = h('div', { class: 'cover-actors' })
prompt.append(actors)
const clawd = new Clawd(actors, { px: 30, x: 1400, y: 0 })
gsap.set(clawd.armR, { y: -3 })

const design = h('div', { class: 'design' }, [top, bannerBox, title, prompt, h('div', { class: 'foot', text: '? for shortcuts' })])
if (H !== DESIGN_H) {
  // 16:9：整体缩小，水平居中；背景的点阵仍然铺满
  const k = H / DESIGN_H
  design.style.transform = `translateX(${(1920 - 1920 * k) / 2}px) scale(${k})`
}
root.append(h('div', { class: 'grid' }), design)

// 字体加载完再放行（导出脚本等这个标志）。无头浏览器里 rAF 不可靠，所以不用它
await Promise.all([
  document.fonts.load('900 220px "Noto Sans SC"', '的前世今生小克学分钟AI'),
  document.fonts.load('500 60px "Noto Sans SC"', '的大脑是怎么来？“”'),
  document.fonts.load('600 60px "Maple Mono"', 'Claude>'),
  document.fonts.load('400 28px "Maple Mono"', '? for shortcuts'),
])
await document.fonts.ready
Object.assign(window, { __coverReady: true })
