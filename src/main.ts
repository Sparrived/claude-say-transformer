import '@fontsource/maple-mono/400.css'
import '@fontsource/maple-mono/600.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import './scenes.css'
import './player.css'

import { gsap } from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { h } from './lib/dom'
import { encodeWav, toBase64 } from './lib/wav'
import { CLAWD_HOME, CLAWD_PX, H, W } from './layout'
import { Clawd } from './clawd/clawd'
import { Bubble } from './ui/bubble'
import { Terminal } from './ui/terminal'
import { Sfx } from './ui/sfx'
import { Score } from './ui/score'
import { Director } from './director'
import { SCENES } from './scenes'
import { createPlayer } from './player'

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin)

const stage = document.getElementById('stage')!
const params = new URLSearchParams(location.search)
const renderMode = params.has('render')

// 1920×1080 的舞台等比缩放、居中
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H)
  stage.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`
}
fit()
addEventListener('resize', fit)

/**
 * 导出前的字体屏障。@fontsource 的中文字体按 unicode-range 切成上百个子集，只有真正
 * 参与排版时才会去请求对应文件；若不等它们到齐就逐帧截图，开头若干帧会用回退字体渲染，
 * 字体到货后字形和字宽跳变（多段并行导出时每个分段开头都会重演一次）。
 * 只在渲染模式调用，必须在 window.__movie 暴露之前完成。
 */
async function fontBarrier() {
  const text = document.body.textContent ?? ''
  // 1) 强制一次 layout，让 DOM 里所有文字的 @font-face 请求真的发出（含 KaTeX 字体）
  void document.body.offsetHeight
  // 2) 拿全片真实文本，把实际用到的每个字重下的 unicode-range 子集一次性拉全
  const specs = [
    'normal 400 40px "Noto Sans SC"',
    'normal 500 40px "Noto Sans SC"',
    'normal 700 40px "Noto Sans SC"',
    'normal 400 30px "Maple Mono"',
    'normal 600 30px "Maple Mono"',
  ]
  await Promise.all(specs.map((s) => document.fonts.load(s, text)))
  // 3) 等 loading 全部收敛，并对覆盖率做个兜底断言（漏载时在导出日志里能看见）
  await document.fonts.ready
  const missing = specs.filter((s) => !document.fonts.check(s, text))
  if (missing.length) console.warn('[render] 字体未完全就绪：', missing.join(' / '))
}

async function boot() {
  // 字体加载完再排版，避免逐字动画的位置跳动
  await document.fonts.load('500 40px "Noto Sans SC"', '前世今生')
  await document.fonts.load('400 30px "Maple Mono"', 'Transformer')
  await document.fonts.ready

  const layers = h('div', { class: 'layers' })
  const sfx = new Sfx()
  stage.append(layers)
  const term = new Terminal(stage, sfx)
  const actors = h('div', { class: 'actors' })
  stage.append(actors)
  const clawd = new Clawd(actors, { px: CLAWD_PX, x: CLAWD_HOME.x, y: CLAWD_HOME.y })
  const bubble = new Bubble(actors)

  const d = new Director({ layers, clawd, bubble, term, sfx })
  for (const scene of SCENES) scene(d)
  const duration = d.finish()
  // 背景音乐：?music=0 可以关掉（对比、或者只想要音效时用）
  if (params.get('music') !== '0') sfx.score = new Score(d.chapters, d.cues, duration)
  // 论文页和公式用到的衬线字体，在场景搭好之后才开始加载
  await document.fonts.ready

  const movie = { tl: d.tl, chapters: d.chapters, duration, sfx }
  if (renderMode) {
    // 给导出脚本用：逐帧 seek，再截图
    document.body.classList.add('render-mode')
    await fontBarrier()
    let wav = new Uint8Array()
    Object.assign(window, {
      __movie: {
        duration,
        chapters: d.chapters,
        cues: d.cues,
        seek: (t: number) => {
          d.tl.seek(t, true)
        },
        // 音轨先在页面里离线渲染成 WAV，再分块取走，避免一次传输过大
        prepareAudio: async () => {
          wav = encodeWav(await sfx.render(duration, 48000, { sfx: params.get('sfx') !== '0' }))
          return wav.length
        },
        audioChunk: (offset: number, size: number) => toBase64(wav.subarray(offset, offset + size)),
      },
    })
    d.tl.seek(0, true)
  } else {
    createPlayer(document.getElementById('player')!, stage, movie)
  }
  Object.assign(window, { __tl: d.tl, __sfx: sfx })
}

void boot()
