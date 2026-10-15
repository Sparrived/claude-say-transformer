import { createBus, LiveScore, SCORE_PREROLL, type Score } from './score'

export type SoundKind = 'blip' | 'key' | 'enter' | 'pop' | 'thud' | 'whoosh' | 'ding' | 'tick'

export interface SoundEvent {
  t: number
  kind: SoundKind
  seed: number
}

/**
 * 8-bit 小音效。构建动画时把每个音效登记成 {时间, 类型}，
 * 播放时按时间轴进度触发；导出视频时用 OfflineAudioContext 一次性渲染成音轨。
 * 这样声音和画面永远对齐，拖动进度条也不会乱响。
 */
export class Sfx {
  readonly events: SoundEvent[] = []
  muted = false
  /** 背景音乐：和音效走同一条时间轴、同一套导出流程。为空就只有音效 */
  score: Score | null = null
  private live: LiveScore | null = null
  /** 每个离线窗口的时长，仅导出用；调大调小只影响渲染速度，不影响音轨内容 */
  private windowSeconds = WINDOW_SECONDS
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private noise: AudioBuffer | null = null

  at(t: number, kind: SoundKind, seed = 0) {
    this.events.push({ t, kind, seed })
  }

  finalize() {
    this.events.sort((a, b) => a.t - b.t)
  }

  /** 浏览器要求用户手势后才能出声 */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.out = this.ctx.createGain()
      this.out.gain.value = 0.8
      this.out.connect(this.ctx.destination)
    }
    if (this.score && !this.live) this.live = new LiveScore(this.ctx, this.out!, this.score)
    void this.ctx.resume()
  }

  /** 让背景音乐跟上时间轴：t = 时间轴当前时间，playing = 是否正在正向播放（暂停、拖动中都传 false） */
  sync(t: number, playing: boolean) {
    this.live?.sync(t, playing && !this.muted)
  }

  /** 播放 (from, to] 时间段内登记的音效 */
  playRange(from: number, to: number) {
    if (this.muted || !this.ctx || !this.out || to <= from) return
    let lo = 0
    let hi = this.events.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.events[mid].t <= from) lo = mid + 1
      else hi = mid
    }
    const now = this.ctx.currentTime
    for (let i = lo; i < this.events.length && this.events[i].t <= to; i++) {
      this.voice(this.ctx, this.out, this.events[i], now + 0.01)
    }
  }

  /**
   * 离线渲染整条音轨（导出视频用）。
   *
   * OfflineAudioContext 的开销 ≈ 0.1ms × 上下文里的节点数 × 上下文时长，和节点实际响多久无关：
   * 整条 400s 音轨一次性渲染时，几千个只响几十毫秒的音效会被按整段时长摊计算，动辄几分钟。
   * 所以这里按时间窗分块：每个窗口只建「这一窗里可能发声」的节点，渲染完按帧裁齐、逐样本拼起来。
   * 窗口带 pre-roll，窗口边界处跨过来的声音会在下一窗里重新合成，因此拼接处是连续的。
   */
  async render(duration: number, sampleRate = 48000, mix: { sfx?: boolean; music?: boolean } = {}): Promise<AudioBuffer> {
    const { sfx = true, music = true } = mix
    const total = Math.ceil((duration + 1) * sampleRate)
    const track = new OfflineAudioContext(1, QUANTUM, sampleRate).createBuffer(2, total, sampleRate)
    if (sfx) await this.renderEvents(track, sampleRate)
    if (music && this.score) await this.renderScore(track, sampleRate, this.score)
    return track
  }

  /** 音效：按时间窗分块渲染（原理见 render 的注释） */
  private async renderEvents(track: AudioBuffer, sampleRate: number) {
    const total = track.length
    const events = [...this.events].sort((a, b) => a.t - b.t)
    const span = Math.max(QUANTUM, Math.round((this.windowSeconds * sampleRate) / QUANTUM) * QUANTUM)
    const preroll = Math.ceil((OVERLAP_SECONDS * sampleRate) / QUANTUM) * QUANTUM
    for (let start = 0; start < total; start += span) {
      const end = Math.min(total, start + span)
      const pre = Math.min(preroll, start) // 起点附近的声音要一起渲染，否则窗口开头会缺一截
      const from = start - pre
      let i = lowerBound(events, from / sampleRate)
      if (i >= events.length || events[i].t * sampleRate >= end) continue // 整窗静音：留白即可
      const ctx = new OfflineAudioContext(2, end - from, sampleRate)
      const out = ctx.createGain()
      out.gain.value = 0.8
      out.connect(ctx.destination)
      const origin = from / sampleRate
      for (; i < events.length && events[i].t * sampleRate < end; i++) this.voice(ctx, out, events[i], events[i].t - origin)
      const buf = await ctx.startRendering()
      for (let c = 0; c < 2; c++) track.copyToChannel(buf.getChannelData(c).subarray(pre), c, start)
    }
  }

  /**
   * 配乐：同样按时间窗分块，但预卷更长（SCORE_PREROLL），要盖住铺底音的释音和回声的尾巴。
   * 渲染结果逐样本累加到音轨上（音效已经在里面了）。
   */
  private async renderScore(track: AudioBuffer, sampleRate: number, score: Score) {
    const total = track.length
    const span = Math.max(QUANTUM, Math.round((SCORE_WINDOW_SECONDS * sampleRate) / QUANTUM) * QUANTUM)
    const preroll = Math.ceil((SCORE_PREROLL * sampleRate) / QUANTUM) * QUANTUM
    for (let start = 0; start < total; start += span) {
      const end = Math.min(total, start + span)
      const pre = Math.min(preroll, start)
      const from = start - pre
      const notes = score.range(from / sampleRate, end / sampleRate)
      if (!notes.length) continue
      const ctx = new OfflineAudioContext(2, end - from, sampleRate)
      const out = ctx.createGain()
      out.gain.value = 0.8
      out.connect(ctx.destination)
      score.play(createBus(ctx, out), notes, 0, from / sampleRate)
      const buf = await ctx.startRendering()
      for (let c = 0; c < 2; c++) {
        const dst = track.getChannelData(c)
        const src = buf.getChannelData(c)
        for (let i = pre; i < src.length; i++) dst[start + i - pre] += src[i]
      }
    }
  }

  private noiseBuffer(ctx: BaseAudioContext) {
    if (this.noise && this.noise.sampleRate === ctx.sampleRate) return this.noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let x = 12345
    for (let i = 0; i < data.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff
      data[i] = (x / 0x7fffffff) * 2 - 1
    }
    this.noise = buf
    return buf
  }

  private tone(
    ctx: BaseAudioContext,
    out: AudioNode,
    when: number,
    { type = 'square', f0, f1 = f0, dur, gain }: { type?: OscillatorType; f0: number; f1?: number; dur: number; gain: number },
  ) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    osc.type = type
    osc.frequency.setValueAtTime(f0, when)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, when + dur)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(gain, when + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(lp).connect(g).connect(out)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  private hiss(ctx: BaseAudioContext, out: AudioNode, when: number, dur: number, gain: number, f0: number, f1: number) {
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(f0, when)
    bp.frequency.exponentialRampToValueAtTime(f1, when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(gain, when + Math.min(0.02, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(bp).connect(g).connect(out)
    src.start(when)
    src.stop(when + dur + 0.02)
  }

  private voice(ctx: BaseAudioContext, out: AudioNode, ev: SoundEvent, when: number) {
    switch (ev.kind) {
      case 'blip': {
        // 动物森友会式的“说话声”：音高随字符变化
        const f = this.score ? PENTATONIC[ev.seed % PENTATONIC.length] : 480 + (ev.seed % 9) * 32
        this.tone(ctx, out, when, { f0: f, f1: f * 0.92, dur: 0.055, gain: this.score ? 0.05 * BLIP_BOOST : 0.05 })
        break
      }
      case 'key':
        this.hiss(ctx, out, when, 0.028, 0.16, 3800, 2400)
        this.tone(ctx, out, when, { type: 'triangle', f0: 1700 + (ev.seed % 5) * 60, dur: 0.018, gain: 0.03 })
        break
      case 'enter':
        this.hiss(ctx, out, when, 0.05, 0.22, 2200, 1200)
        this.tone(ctx, out, when, { type: 'triangle', f0: 900, f1: 600, dur: 0.06, gain: 0.05 })
        break
      case 'pop':
        this.tone(ctx, out, when, { type: 'sine', f0: 320, f1: 820, dur: 0.09, gain: 0.09 })
        break
      case 'thud':
        this.tone(ctx, out, when, { type: 'sine', f0: 150, f1: 55, dur: 0.18, gain: 0.22 })
        break
      case 'whoosh':
        this.hiss(ctx, out, when, 0.38, 0.07, 500, 2600)
        break
      case 'ding':
        this.tone(ctx, out, when, { type: 'sine', f0: 1046, dur: 0.5, gain: 0.07 })
        this.tone(ctx, out, when + 0.07, { type: 'sine', f0: 1568, dur: 0.6, gain: 0.05 })
        break
      case 'tick':
        this.tone(ctx, out, when, { type: 'square', f0: 1200 + (ev.seed % 4) * 120, dur: 0.025, gain: 0.025 })
        break
    }
  }
}

/** 离线渲染的窗口时长（秒）。窗口越小总开销越低，但创建的上下文越多 */
const WINDOW_SECONDS = 4
/** 配乐的窗口时长（秒）：预卷长（6s），窗口也要取得大一些，预卷的重复渲染才不至于占大头 */
const SCORE_WINDOW_SECONDS = 6
/** 说话声的音高：有配乐时吸附到 C 大调五声音阶（C5 D5 E5 G5 A5），免得和铺底的和弦打架 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880]
/** 有配乐时说话声抬多少倍（2 倍 ≈ +6 dB）：它本来是整条音轨里最轻的声音，不抬的话会被音乐盖住 */
const BLIP_BOOST = 2
/** 窗口预卷（秒）：接住上一窗末尾还没响完的声音。最长的音效是 ding：0.07 + 0.6 + 0.02 = 0.69s */
const OVERLAP_SECONDS = 0.75
/**
 * 离线渲染以 128 帧为一个 render quantum，且 quantum 网格锚在上下文第 0 帧上。
 * 窗口起点必须落在 quantum 边界上，否则同一个音效会因为 quantum 相位不同而渲染出不同的样本
 * （实测：起点差 32 帧，一个 thud 的最大逐样本差就有 0.18），拼接处会对不上。
 */
const QUANTUM = 128

/** 二分找第一个 t >= time 的事件下标（events 已按时间排序） */
function lowerBound(events: SoundEvent[], time: number) {
  let lo = 0
  let hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].t < time) lo = mid + 1
    else hi = mid
  }
  return lo
}
