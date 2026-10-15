import { h } from './lib/dom'
import type { Chapter } from './director'
import type { Sfx } from './ui/sfx'

interface Movie {
  tl: gsap.core.Timeline
  chapters: Chapter[]
  duration: number
  sfx: Sfx
}

const fmt = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 播放器：播放/暂停、可拖动的进度条（带章节刻度）、键盘快捷键、静音、全屏。
 * 快捷键：空格 播放/暂停 · ←/→ 上一章/下一章 · J/L 后退/前进 5 秒 · M 静音 · F 全屏
 */
export function createPlayer(root: HTMLElement, stage: HTMLElement, movie: Movie) {
  const { tl, chapters, duration, sfx } = movie
  const params = new URLSearchParams(location.search)

  const playBtn = h('button', { class: 'pl-btn pl-play', 'aria-label': '播放' })
  const time = h('span', { class: 'pl-time' })
  const fill = h('div', { class: 'pl-fill' })
  const knob = h('div', { class: 'pl-knob' })
  const ticks = chapters.slice(1).map((c) => {
    const tick = h('div', { class: 'pl-tick', title: c.title })
    tick.style.left = `${(c.time / duration) * 100}%`
    return tick
  })
  const track = h('div', { class: 'pl-track', role: 'slider', tabindex: 0, 'aria-label': '播放进度' }, [fill, ...ticks, knob])
  const chapterName = h('span', { class: 'pl-chapter' })
  const muteBtn = h('button', { class: 'pl-btn pl-mute', 'aria-label': '静音' })
  const fsBtn = h('button', { class: 'pl-btn pl-fs', 'aria-label': '全屏', text: '⛶' })
  const bar = h('div', { class: 'pl-bar' }, [playBtn, time, track, chapterName, muteBtn, fsBtn])

  const startBtn = h('button', { class: 'pl-start' }, [
    h('span', { class: 'pl-start-icon', text: '▶' }),
    h('span', { text: '开始播放' }),
  ])
  const hint = h('div', { class: 'pl-hint', text: '空格 播放/暂停　←/→ 切换章节　M 静音　F 全屏' })
  const cover = h('div', { class: 'pl-cover' }, [startBtn, hint])
  root.append(cover, bar)

  let started = false
  let scrubbing = false
  let lastT = 0

  const chapterAt = (t: number) => {
    let i = 0
    while (i + 1 < chapters.length && chapters[i + 1].time <= t + 1e-3) i++
    return i
  }

  const render = () => {
    const t = tl.time()
    const p = t / duration
    fill.style.width = `${p * 100}%`
    knob.style.left = `${p * 100}%`
    time.textContent = `${fmt(t)} / ${fmt(duration)}`
    const c = chapters[chapterAt(t)]
    chapterName.textContent = c ? c.title : ''
    playBtn.textContent = tl.paused() ? '▶' : '❚❚'
    playBtn.setAttribute('aria-label', tl.paused() ? '播放' : '暂停')
    muteBtn.textContent = sfx.muted ? '🔇' : '🔊'
    // 背景音乐：正在正向播放时往前预约；暂停 / 拖动 / 静音时淡出
    sfx.sync(t, !tl.paused() && !scrubbing)
  }

  // 音效跟着时间轴走：只在正常向前播放时触发
  tl.eventCallback('onUpdate', () => {
    const t = tl.time()
    if (!scrubbing && !tl.paused() && t > lastT && t - lastT < 0.3) sfx.playRange(lastT, t)
    lastT = t
    render()
  })
  tl.eventCallback('onComplete', () => {
    render()
    document.body.classList.remove('pl-idle')
  })

  const seek = (t: number) => {
    lastT = Math.min(duration, Math.max(0, t))
    tl.seek(lastT, true)
    render()
  }

  const play = () => {
    if (!started) {
      started = true
      cover.classList.add('pl-gone')
    }
    sfx.unlock()
    if (tl.time() >= duration - 0.05) seek(0)
    lastT = tl.time()
    tl.play()
    render()
  }
  const pause = () => {
    tl.pause()
    render()
  }
  const toggle = () => (tl.paused() ? play() : pause())

  const goChapter = (dir: 1 | -1) => {
    const t = tl.time()
    let i = chapterAt(t)
    // 当前章开头 2 秒之后按“上一章”，先回到本章开头
    if (dir < 0 && t - chapters[i].time > 2) i += 1
    const next = Math.min(chapters.length - 1, Math.max(0, i + dir))
    seek(chapters[next].time)
  }

  // 进度条拖动
  const seekFromPointer = (e: PointerEvent) => {
    const r = track.getBoundingClientRect()
    seek(((e.clientX - r.left) / r.width) * duration)
  }
  let wasPlaying = false
  track.addEventListener('pointerdown', (e) => {
    scrubbing = true
    wasPlaying = !tl.paused()
    tl.pause()
    track.setPointerCapture(e.pointerId)
    seekFromPointer(e)
  })
  track.addEventListener('pointermove', (e) => scrubbing && seekFromPointer(e))
  track.addEventListener('pointerup', () => {
    scrubbing = false
    if (wasPlaying) play()
  })

  playBtn.addEventListener('click', toggle)
  startBtn.addEventListener('click', play)
  stage.addEventListener('click', toggle)
  muteBtn.addEventListener('click', () => {
    sfx.muted = !sfx.muted
    render()
  })
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())
  fsBtn.addEventListener('click', () => void fullscreen())

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        toggle()
        break
      case 'ArrowRight':
        e.preventDefault()
        if (e.shiftKey) seek(tl.time() + 5)
        else goChapter(1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (e.shiftKey) seek(tl.time() - 5)
        else goChapter(-1)
        break
      case 'l':
        seek(tl.time() + 5)
        break
      case 'j':
        seek(tl.time() - 5)
        break
      case 'Home':
      case '0':
        seek(0)
        break
      case 'm':
        sfx.muted = !sfx.muted
        render()
        break
      case 'f':
        void fullscreen()
        break
    }
  })

  // 鼠标不动 2.5 秒后隐藏控制条
  let idleTimer = 0
  const wake = () => {
    document.body.classList.remove('pl-idle')
    clearTimeout(idleTimer)
    idleTimer = window.setTimeout(() => !tl.paused() && document.body.classList.add('pl-idle'), 2500)
  }
  window.addEventListener('pointermove', wake)
  window.addEventListener('keydown', wake)

  // URL 参数：?t=秒 / ?ch=章节id / ?autoplay
  const t0 = Number(params.get('t'))
  const ch = params.get('ch')
  if (ch) {
    const c = chapters.find((x) => x.id === ch)
    if (c) seek(c.time)
  } else if (t0) seek(t0)
  if (params.has('autoplay')) play()
  render()
}
