/**
 * 配乐：全片的背景音乐。
 *
 * 全部用 Web Audio 现场合成（方波、三角波、噪声），没有任何采样，所以没有版权问题，可以随视频一起发布。
 *
 * 做法和音效一样：构建动画时先把整首曲子“写”成一张按时间排好的音符表，
 *  - 导出视频：Sfx.render() 按时间窗分块离线渲染；
 *  - 网页播放：LiveScore 跟着时间轴往前预约；暂停 / 拖动进度条时，把旧的一批静音，从新位置重新预约。
 *
 * 曲子的结构跟着章节走：每章换一套和弦和乐器，章节开头正好落在小节线上
 * （每章的小节长度在 2.6s 上下微调，让整数个小节刚好填满这一章），几个关键时刻另有标记（cue）：
 * Clawd 落地、片名出现、GPT-3 的柱子冲出画面、最后的 /exit。
 *
 * 这个文件不依赖 DOM，Node 里也能直接 import，用来检查音符表。
 */

// ── 可调参数 ───────────────────────────────────────
/** 配乐总音量：整体调大调小，只改这一个数。0.75 时全曲约 −22 LUFS，最安静的章节约 −26，最热闹的约 −19 */
export const MUSIC_GAIN = 0.75
/** 离线分块渲染的预卷（秒）：必须盖住最长音符（含释音）和回声的尾巴 */
export const SCORE_PREROLL = 6
/** 配乐从第几秒进来：欢迎框出现的时候 */
const START = 2
/** 目标小节长度（秒）≈ 92 BPM */
const BAR = 2.6
/** 结尾淡出多久（秒）：最后的 /exit 落地离片尾只有 5s，C 和弦要先以正常音量落地，再慢慢淡出 */
const FADE_OUT = 5
/** 铺底音色的交叉淡入淡出时长（秒） */
const PAD_FADE = 0.8
/** 回声一共几级（左右交替）；最后一级出现在 3.3s 之后 */
const ECHO_TAPS = 8
/** 回声的尾巴（秒）：离线渲染的预卷要在最长的音符之外再盖住它 */
export const ECHO_TAIL = 3.4
/** 各乐器的基础音量：调整配乐内部的平衡，改这里 */
const LEVEL = { pad: 0.05, bass: 0.2, arp: 0.09, lead: 0.07, bell: 0.08, kick: 0.55, snare: 0.16, hat: 0.05 } as const

export type Voice = 'pad' | 'bass' | 'arp' | 'lead' | 'bell' | 'kick' | 'snare' | 'hat' | 'swell' | 'boom'

export interface Note {
  /** 开始时间（秒，时间轴时间） */
  t: number
  /** 持续时间，不含释音 */
  dur: number
  voice: Voice
  /** MIDI 音高；打击乐用不到 */
  midi: number
  /** 力度 0..1（已含淡入淡出） */
  vel: number
  /** 琶音的声像：负数在左，正数在右；其他乐器忽略 */
  pan: number
}

export interface Bar {
  t: number
  len: number
  section: string
  chord: string
}

interface ChapterLike {
  id: string
  time: number
}

// ── 乐理 ──────────────────────────────────────────
interface Chord {
  name: string
  /** 音级（0–11，C = 0） */
  pcs: number[]
  root: number
}

const chord = (name: string, root: number, ...intervals: number[]): Chord => ({
  name,
  root,
  pcs: intervals.map((i) => (root + i) % 12),
})
const MAJ = [0, 4, 7]
const MIN = [0, 3, 7]
const CH = {
  C: chord('C', 0, ...MAJ),
  Cmaj7: chord('Cmaj7', 0, 0, 4, 7, 11),
  Dm: chord('Dm', 2, ...MIN),
  Dm7: chord('Dm7', 2, 0, 3, 7, 10),
  E: chord('E', 4, ...MAJ),
  Em7: chord('Em7', 4, 0, 3, 7, 10),
  F: chord('F', 5, ...MAJ),
  Fmaj7: chord('Fmaj7', 5, 0, 4, 7, 11),
  G: chord('G', 7, ...MAJ),
  G6: chord('G6', 7, 0, 4, 7, 9),
  G7: chord('G7', 7, 0, 4, 7, 10),
  Am: chord('Am', 9, ...MIN),
  Am7: chord('Am7', 9, 0, 3, 7, 10),
}

// 全曲都在 C 大调 / A 小调里，章节之间换的只是和弦进行和乐器
const PROG = {
  axis: [CH.C, CH.G, CH.Am, CH.F], // I–V–vi–IV：明亮、安稳
  royal: [CH.Fmaj7, CH.G6, CH.Em7, CH.Am7], // IV–V–iii–vi：日系“王道进行”，带一点怀旧
  ascend: [CH.Cmaj7, CH.Dm7, CH.Em7, CH.Fmaj7], // 低音一级一级往上走：有什么要发生了
  nostalgia: [CH.Am7, CH.Fmaj7, CH.Cmaj7, CH.G6], // vi–IV–I–V：旧时光
  tension: [CH.Am, CH.Dm, CH.E, CH.Am], // i–iv–V–i：小调，压抑
  iivi: [CH.Dm7, CH.G7, CH.Cmaj7, CH.Am7], // ii–V–I–vi：爵士味，“在思考”
}

/**
 * 主旋律：每个乐句 4 小节、每小节 8 个八分音符。
 * 音名 = 音高，`~` = 延长上一个音，`-` = 休止。旋律全部落在和弦音上，经过音只出现在弱拍。
 */
const MOTIFS: Record<string, string[][]> = {
  axis: [
    ['E5 ~ G5 ~ C6 ~ B5 G5', 'A5 ~ G5 ~ D5 ~ - B4', 'C5 ~ E5 ~ A5 ~ G5 E5', 'A5 ~ G5 ~ F5 ~ E5 ~'],
    ['G5 ~ ~ E5 G5 ~ C6 ~', 'B5 ~ A5 G5 D5 ~ ~ -', 'E5 ~ ~ C5 E5 ~ A5 ~', 'C6 ~ A5 ~ F5 ~ ~ ~'],
  ],
  royal: [
    ['C6 ~ A5 ~ F5 A5 C6 ~', 'B5 ~ G5 ~ D5 G5 B5 ~', 'G5 ~ E5 ~ B4 E5 G5 ~', 'E5 ~ A5 ~ C6 ~ B5 A5'],
    ['A5 ~ ~ G5 F5 ~ E5 ~', 'D5 ~ ~ E5 G5 ~ ~ -', 'B5 ~ ~ A5 G5 ~ E5 ~', 'C6 ~ B5 A5 E5 ~ ~ -'],
  ],
  ascend: [['E5 ~ G5 ~ B5 ~ G5 ~', 'F5 ~ A5 ~ C6 ~ A5 ~', 'G5 ~ B5 ~ A5 ~ G5 ~', 'C6 ~ ~ ~ A5 ~ ~ -']],
}

/** 琶音走法：数字是“和弦音里的第几个”（从低到高） */
const ARP_PATTERNS = [
  [0, 1, 2, 3, 2, 1, 0, 1],
  [0, 2, 1, 3, 2, 3, 1, 2],
  [0, 1, 2, 3, 4, 3, 2, 1],
  [2, 1, 0, 1, 2, 3, 4, 3],
]
const ACCENT = [1, 0.55, 0.8, 0.55, 0.92, 0.55, 0.8, 0.62]
const HAT_ACCENT = [0.6, 0.35, 0.75, 0.35, 0.6, 0.35, 0.75, 0.45]

/** 一层乐器的音量：数字 = 全程；[音量, 从, 到] = 只在本段进度的这一截里响（进度 0..1） */
type Layer = number | [gain: number, from?: number, to?: number]

interface Mood {
  prog: Chord[]
  motif?: keyof typeof MOTIFS
  /** 整段的音量系数（≤ 1）：安静的章节调小，热闹的章节保持 1，全曲的起伏就靠它 */
  level?: number
  /** 每个和弦占几小节（默认 1） */
  bpc?: number
  pad?: Layer
  bass?: Layer
  arp?: Layer
  lead?: Layer
  bell?: Layer
  kick?: Layer
  snare?: Layer
  hat?: Layer
  /** 低音拉成长音，不走动 */
  bassLong?: boolean
  /** 琶音只弹四分音符 */
  arpSparse?: boolean
  /** 本段开头来一记重音 */
  boom?: boolean
}

// 每个段落的配器。数字是 0..1 的相对音量，调平衡改这里
const MOODS: Record<string, Mood> = {
  // 开场：先只有一层暖暖的铺底，Clawd 落地之后琶音才进来
  'intro-a': { level: 0.8, prog: PROG.axis, pad: 0.7 },
  'intro-b': { level: 0.85, prog: PROG.axis, motif: 'axis', pad: 0.75, bass: [0.5, 0.25], arp: 0.5 },
  // 前世：怀旧、缓慢，然后是越来越压抑的瓶颈
  rnn: { level: 0.62, prog: PROG.nostalgia, pad: 0.85, bass: 0.5, arp: [0.45, 0.1], arpSparse: true },
  seq2seq: { level: 0.62, prog: PROG.tension, bpc: 2, pad: 1, bass: 0.5, bassLong: true, arp: [0.35, 0.25], arpSparse: true },
  // 转机：和弦一级一级往上，旋律进来，瓶颈被打开
  attention: { level: 0.78, prog: PROG.ascend, motif: 'ascend', pad: 0.85, bass: 0.6, arp: 0.6, lead: [0.55, 0.35], hat: [0.3, 0.5] },
  // 2017：论文登场，鼓点第一次出现
  paper: { level: 0.95, prog: PROG.axis, motif: 'axis', pad: 0.85, bass: 0.8, arp: 0.65, lead: 0.7, kick: 0.55, snare: 0.35, hat: 0.45 },
  // 核心三章：稳定的律动，像在一边讲一边想
  selfattn: { level: 0.85, prog: PROG.royal, motif: 'royal', pad: 0.75, bass: 0.7, arp: 0.75, lead: [0.45, 0.6], kick: [0.5, 0.15], snare: [0.3, 0.4], hat: [0.4, 0.15] },
  parallel: { level: 0.85, prog: PROG.iivi, pad: 0.75, bass: 0.7, arp: 0.8, kick: 0.45, snare: 0.3, hat: 0.4 },
  arch: { level: 0.9, prog: PROG.axis, motif: 'axis', pad: 0.8, bass: 0.75, arp: 0.8, lead: [0.5, 0.5], kick: 0.5, snare: 0.35, hat: 0.45 },
  // 今生：BERT 与 GPT 分家，最热闹
  split: { level: 1, prog: PROG.royal, motif: 'royal', pad: 0.8, bass: 0.85, arp: 0.85, lead: 0.75, kick: 0.65, snare: 0.5, hat: 0.6, boom: true },
  // 规模定律：先一路蓄力，GPT-3 冲出画面的那一刻放开
  'scale-a': { level: 0.85, prog: PROG.ascend, motif: 'ascend', pad: 0.8, bass: 0.65, arp: 0.75, lead: [0.4, 0.6], kick: [0.4, 0.4], hat: [0.35, 0.4] },
  'scale-b': { level: 1, prog: PROG.axis, motif: 'axis', pad: 0.9, bass: 0.9, arp: 0.8, lead: 0.7, kick: 0.7, snare: 0.5, hat: 0.6, boom: true },
  // 万物皆可 token：高处的铃音，像一粒粒小方块在闪
  tokens: { level: 0.72, prog: PROG.royal, pad: 0.7, bass: 0.55, arp: 0.5, arpSparse: true, bell: 0.7, kick: 0.3, hat: [0.3, 0.2] },
  chat: { level: 0.8, prog: PROG.axis, motif: 'axis', pad: 0.85, bass: 0.65, arp: 0.55, lead: [0.5, 0.3], kick: 0.35, snare: 0.2, hat: 0.3 },
  // 今天与明天：渐渐收拢；Clawd 落地之后，落在 C 和弦上
  'now-a': { level: 0.7, prog: PROG.royal, motif: 'royal', pad: 0.8, bass: 0.55, arp: 0.5, lead: [0.4, 0.2, 0.8], kick: [0.3, 0, 0.5], hat: [0.25, 0, 0.5] },
  outro: { level: 0.8, prog: [CH.C], pad: 0.8, bass: 0.5, bassLong: true, bell: 0.8, arp: 0.3, arpSparse: true },
}

/** 这几章在某个 cue 处一分为二：[cue 名, 前半段, 后半段] */
const SPLITS: Record<string, [string, string, string]> = {
  intro: ['hop', 'intro-a', 'intro-b'],
  scale: ['gpt3', 'scale-a', 'scale-b'],
  now: ['land', 'now-a', 'outro'],
}

interface Section {
  id: string
  t0: number
  t1: number
  mood: Mood
}

function layout(chapters: ChapterLike[], cues: Record<string, number>, duration: number): Section[] {
  const out: Section[] = []
  chapters.forEach((c, i) => {
    const t0 = i === 0 ? Math.max(c.time, START) : c.time
    const t1 = chapters[i + 1]?.time ?? duration
    const split = SPLITS[c.id]
    const cut = split ? cues[split[0]] : undefined
    if (split && cut !== undefined && cut > t0 + 2 && cut < t1 - 2) {
      out.push({ id: split[1], t0, t1: cut, mood: MOODS[split[1]] }, { id: split[2], t0: cut, t1, mood: MOODS[split[2]] })
    } else {
      const id = split ? split[1] : c.id
      out.push({ id, t0, t1, mood: MOODS[id] ?? MOODS.chat })
    }
  })
  return out
}

// ── 小工具 ────────────────────────────────────────
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** 音名 → MIDI：C4 = 60 */
function midiOf(name: string) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)
  if (!m) throw new Error(`看不懂的音名：${name}`)
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C']
  return 12 * (Number(m[3]) + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

function parseBar(src: string) {
  const out: { slot: number; midi: number; len: number }[] = []
  src.split(' ').forEach((tok, i) => {
    if (tok === '~') out[out.length - 1].len++
    else if (tok !== '-') out.push({ slot: i, midi: midiOf(tok), len: 1 })
  })
  return out
}

/** 铺底的配置：每个和弦音取离上一个和弦中心最近的那个八度，声部连接最平滑 */
function voicing(c: Chord, prev: number[]) {
  const center = prev.length ? Math.min(62, Math.max(54, prev.reduce((a, b) => a + b, 0) / prev.length)) : 58
  return c.pcs.map((pc) => pc + 12 * Math.round((center - pc) / 12)).sort((a, b) => a - b)
}

/** 从 lo 往上数 n 个和弦音，供琶音取用 */
function pool(c: Chord, lo: number, n = 8) {
  const out: number[] = []
  for (let m = lo; out.length < n; m++) if (c.pcs.includes(m % 12)) out.push(m)
  return out
}

const bassMidi = (pc: number) => (36 + pc < 40 ? 48 + pc : 36 + pc)

/** 确定性的随机数：每次导出的配乐完全一样 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lv = (l: Layer | undefined, p: number) => {
  if (l === undefined) return 0
  if (typeof l === 'number') return l
  const [g, from = 0, to = 1] = l
  return p >= from && p <= to ? g : 0
}

// ── 作曲 ──────────────────────────────────────────
function compose(chapters: ChapterLike[], cues: Record<string, number>, duration: number) {
  const notes: Note[] = []
  const bars: Bar[] = []
  const rnd = rng(1706)
  const fade = (t: number) => clamp01((t - START) / 3.5) * clamp01((duration - 0.2 - t) / FADE_OUT) ** 1.4
  let level = 1 // 当前段落的整体音量系数
  const add = (voice: Voice, t: number, dur: number, midi: number, vel: number, pan = 0) => {
    // 淡入淡出按音符“响起来之后”的位置算：长音（铺底）起点在淡入之前也能有声音
    const v = vel * level * fade(t + Math.min(dur, 1.2) * 0.5)
    if (v > 0.012 && t < duration) notes.push({ t, dur, voice, midi, vel: Math.min(1, v), pan })
  }
  const jit = () => (rnd() - 0.5) * 0.012
  const human = () => 1 + (rnd() - 0.5) * 0.16

  const sections = layout(chapters, cues, duration)
  let prev: number[] = []

  sections.forEach((sec, si) => {
    const m = sec.mood
    level = m.level ?? 1
    const nBars = Math.max(1, Math.round((sec.t1 - sec.t0) / BAR))
    const barLen = (sec.t1 - sec.t0) / nBars
    const slot = barLen / 8
    const bpc = m.bpc ?? 1
    const next = sections[si + 1]

    for (let b = 0; b < nBars; b++) {
      const p = nBars > 1 ? b / (nBars - 1) : 0
      const t = sec.t0 + b * barLen
      // 每一段的最后一小节落在属和弦 G 上：下一章的第一个和弦（C / F / Am）自然地“落地”
      const closing = nBars > 1 && b === nBars - 1 && sec.id !== 'outro'
      const ci = Math.floor(b / bpc) % m.prog.length
      const c = closing ? CH.G : m.prog[ci]
      bars.push({ t, len: barLen, section: sec.id, chord: c.name })

      const gPad = lv(m.pad, p)
      if (gPad) {
        prev = voicing(c, prev)
        for (const midi of prev) add('pad', t, barLen, midi, gPad)
      }

      const gBass = lv(m.bass, p)
      if (gBass) {
        const root = bassMidi(c.root)
        if (m.bassLong) add('bass', t, barLen * 0.96, root, gBass * 0.8)
        else {
          add('bass', t, slot * 3.2, root, gBass)
          add('bass', t + slot * 4, slot * 1.6, root + (b % 2 ? 7 : 0), gBass * 0.8)
          if (b % 4 === 3 && !closing) add('bass', t + slot * 6.5, slot * 1.2, root + 12, gBass * 0.7)
        }
      }

      const gArp = lv(m.arp, p)
      if (gArp) {
        const notesOf = pool(c, 60)
        const pat = ARP_PATTERNS[(Math.floor(b / 4) + m.prog.length) % ARP_PATTERNS.length]
        for (let i = 0; i < 8; i++) {
          if (m.arpSparse && i % 2) continue
          add('arp', t + i * slot + jit(), m.arpSparse ? slot * 1.7 : slot * 0.9, notesOf[pat[i]], gArp * ACCENT[i] * human(), i % 2 ? 1 : -1)
        }
      }

      const gLead = lv(m.lead, p)
      if (gLead && m.motif && !closing) {
        const variants = MOTIFS[m.motif]
        const phrase = variants[Math.floor(b / (bpc * m.prog.length)) % variants.length]
        for (const n of parseBar(phrase[ci])) {
          add('lead', t + n.slot * slot + jit(), n.len * slot * 0.94, n.midi, gLead * (n.slot === 0 ? 1 : 0.85))
        }
      }

      const gBell = lv(m.bell, p)
      if (gBell) {
        const notesOf = pool(c, 72)
        const pat = ARP_PATTERNS[Math.floor(b / 2) % ARP_PATTERNS.length]
        for (let i = 0; i < 8; i++) {
          if (i % 2 && rnd() > 0.45) continue // 奇数位只偶尔响一下，闪烁感更自然
          add('bell', t + i * slot, slot * 1.6, notesOf[pat[i]], gBell * ACCENT[i] * human(), i % 2 ? 1 : -1)
        }
      }

      const gKick = lv(m.kick, p)
      const gSnare = lv(m.snare, p)
      const gHat = lv(m.hat, p)
      if (gKick) {
        add('kick', t, 0.2, 0, gKick)
        add('kick', t + slot * 4, 0.2, 0, gKick * 0.85)
        if (b % 4 === 3 && !closing) add('kick', t + slot * 6, 0.2, 0, gKick * 0.6)
      }
      if (gSnare) {
        add('snare', t + slot * 2, 0.12, 0, gSnare)
        if (!closing) add('snare', t + slot * 6, 0.12, 0, gSnare)
      }
      if (gHat) {
        for (let i = 0; i < 8; i++) add('hat', t + i * slot + jit() * 0.5, i === 7 && b % 4 === 3 ? 0.14 : i % 2 ? 0.03 : 0.045, 0, gHat * HAT_ACCENT[i] * human())
      }
      // 过门：最后一拍打一串军鼓，把人带进下一章
      if (closing && (gKick || gSnare)) {
        const g = gSnare || gKick
        ;[5, 6, 7].forEach((i, k) => add('snare', t + i * slot, 0.12, 0, g * (0.45 + k * 0.2)))
        add('snare', t + 7.5 * slot, 0.12, 0, g * 0.95)
      }
    }

    // 段落之间：一阵噪声从低扫到高，正好停在下一章的第一拍；下一段越热闹，扫得越长越响
    if (next) {
      const heavy = next.mood.boom ? 1 : next.mood.kick ? 0.55 : 0.3
      const rise = barLen * (next.mood.boom ? 1.6 : 0.9)
      add('swell', sec.t1 - rise, rise, 0, heavy)
    }
    if (m.boom) add('boom', sec.t0, 1.8, 0, 1)
  })

  // 关键时刻的小装饰：一串上行的铃音（C 大调五声音阶，叠在哪个和弦上都不难听）
  const sparkle = (t: number | undefined, vel: number) => {
    if (t === undefined) return
    ;[84, 88, 91, 93, 96].forEach((midi, i) => add('bell', t + i * 0.07, 0.4, midi, vel, i % 2 ? 1 : -1))
  }
  sparkle(cues.title, 0.8)
  sparkle(cues['paper-title'], 0.9)

  notes.sort((a, b) => a.t - b.t)
  return { notes, bars }
}

// ── 音符表 ────────────────────────────────────────
const SUSTAINED = new Set<Voice>(['pad', 'bass', 'lead'])

/** 一个音符从开始到彻底没声音，一共占多久（含释音，不含回声） */
function footprint(n: Note) {
  switch (n.voice) {
    case 'pad':
      return n.dur + PAD_FADE
    case 'bass':
      return n.dur + 0.14
    case 'lead':
      return n.dur + 0.12
    case 'arp':
      return n.dur * 1.3 + 0.15
    case 'bell':
      return 1.05
    case 'boom':
      return 1.85
    case 'swell':
      return n.dur + 0.08
    default:
      return 0.3
  }
}

export class Score {
  readonly notes: Note[]
  readonly bars: Bar[]
  readonly duration: number
  /** 最长的一个音符（含释音）：离线分块渲染的预卷必须盖得住它 */
  readonly maxFootprint: number
  /** 铺底 / 低音 / 主旋律里最长的持续音：从中间开始播放时，要往回找这么远 */
  private readonly reach: number

  constructor(chapters: ChapterLike[], cues: Record<string, number>, duration: number) {
    const { notes, bars } = compose(chapters, cues, duration)
    this.notes = notes
    this.bars = bars
    this.duration = duration
    this.maxFootprint = notes.reduce((a, n) => Math.max(a, footprint(n)), 0)
    this.reach = notes.reduce((a, n) => (SUSTAINED.has(n.voice) ? Math.max(a, n.dur) : a), 0)
  }

  /**
   * 开始时间落在 [from, to) 的音符。
   * includeSounding：再带上 from 之前开始、此刻还没放完的持续音（从进度条中间开始播放时用）。
   */
  range(from: number, to: number, includeSounding = false): Note[] {
    const out: Note[] = []
    const lo = lowerBound(this.notes, includeSounding ? from - this.reach : from)
    for (let i = lo; i < this.notes.length && this.notes[i].t < to; i++) {
      const n = this.notes[i]
      if (n.t >= from || (includeSounding && SUSTAINED.has(n.voice) && n.t + n.dur > from)) out.push(n)
    }
    return out
  }

  /**
   * 把音符预约进音频上下文：时间轴上的 n.t 对应音频时钟的 base + (n.t - origin)。
   * 持续音已经错过的开头会被剪掉，从此刻接着奏完。
   */
  play(bus: Bus, notes: Note[], base: number, origin: number) {
    const now = bus.ctx.currentTime
    for (const n of notes) {
      let when = base + (n.t - origin)
      let dur = n.dur
      let resumed = false
      if (when < now) {
        if (SUSTAINED.has(n.voice)) {
          resumed = n.t < origin
          dur -= now - when
        }
        when = now
      }
      // 只有持续音需要“剩多少”的判断；打击乐 / 拨弦的 dur 只是衰减时间，不能拿来过滤
      if (!SUSTAINED.has(n.voice) || dur > 0.03) playNote(bus, n, when, dur, resumed)
    }
  }
}

function lowerBound(notes: Note[], time: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (notes[mid].t < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

// ── 合成 ──────────────────────────────────────────
export interface Bus {
  ctx: BaseAudioContext
  /** 总闸：网页里暂停 / 拖动进度条时，把旧的一批整体淡出 */
  gate: GainNode
  pad: AudioNode
  bass: AudioNode
  arp: [AudioNode, AudioNode]
  lead: AudioNode
  bell: AudioNode
  /** 打击乐入口：军鼓过带通、镲片过高通、其余直通 */
  snare: AudioNode
  hat: AudioNode
  kit: AudioNode
  noise: AudioBuffer
  wave: { thin: PeriodicWave; mid: PeriodicWave; bass: PeriodicWave }
}

function pulseWave(ctx: BaseAudioContext, duty: number) {
  const real = new Float32Array(48)
  for (let n = 1; n < real.length; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  return ctx.createPeriodicWave(real, new Float32Array(real.length))
}

/** 建一整套配乐用的混音线路。每个音频上下文（离线窗口 / 网页实时）各建一份 */
export function createBus(ctx: BaseAudioContext, dest: AudioNode): Bus {
  const gain = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }
  const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const pan = (v: number) => {
    const p = ctx.createStereoPanner()
    p.pan.value = v
    return p
  }

  // 总线：求和 → 压缩（只管峰值：几层同时撞在一起时不至于冲顶，不要把章节之间的起伏压平）→ 总音量 → 总闸
  const gate = gain(1)
  const master = gain(MUSIC_GAIN)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -9
  comp.knee.value = 8
  comp.ratio.value = 3
  comp.attack.value = 0.006
  comp.release.value = 0.2
  const sum = gain(1)
  sum.connect(comp)
  comp.connect(master)
  master.connect(gate)
  gate.connect(dest)

  // 回声：左右乒乓，每一圈衰减 0.36 并变暗，给琶音和铃音加一点空间感。
  // 这里把“反馈环”展开成 8 级串联，而不是真的接成环：Chrome 处理带环的延迟网络时，
  // 结果会随渲染窗口的位置有细微差异，分窗口渲染时窗口之间就对不上（实测差 −45 dB，不是预卷不够）。
  // 第 8 圈只剩 0.36^7 ≈ −71 dB，截断听不出来。最后一个回声在 3.3s 之后。
  const echo = gain(1)
  const wet = gain(0.5)
  wet.connect(sum)
  let feed: AudioNode = echo
  for (let k = 0; k < ECHO_TAPS; k++) {
    const d = ctx.createDelay(1)
    d.delayTime.value = k % 2 ? 0.495 : 0.33
    feed.connect(d)
    d.connect(pan(k % 2 ? 0.7 : -0.7)).connect(wet)
    if (k < ECHO_TAPS - 1) {
      const next = filter('lowpass', 2400)
      d.connect(gain(0.36)).connect(next)
      feed = next
    }
  }

  // 乐器通道：增益 →（滤波）→（声像）→ 总线，并可分一路送去回声
  const line = (filt: BiquadFilterNode | null, send = 0, p = 0) => {
    const head = gain(1)
    let tail: AudioNode = head
    if (filt) {
      head.connect(filt)
      tail = filt
    }
    if (send) tail.connect(gain(send)).connect(echo)
    if (p) {
      const node = pan(p)
      tail.connect(node)
      tail = node
    }
    tail.connect(sum)
    return head
  }
  const kit = line(null)
  const snare = filter('bandpass', 1900, 0.8)
  const hat = filter('highpass', 7000)
  snare.connect(kit)
  hat.connect(kit)

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  let x = 24680
  for (let i = 0; i < data.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    data[i] = (x / 0x7fffffff) * 2 - 1
  }

  return {
    ctx,
    gate,
    pad: line(filter('lowpass', 1500, 0.6)),
    bass: line(filter('lowpass', 420)),
    arp: [line(filter('lowpass', 3000), 0.45, -0.35), line(filter('lowpass', 3000), 0.45, 0.35)],
    lead: line(filter('lowpass', 2800), 0.4),
    bell: line(filter('highpass', 400), 0.6, 0.15),
    snare,
    hat,
    kit,
    noise,
    wave: {
      thin: pulseWave(ctx, 0.125),
      mid: pulseWave(ctx, 0.25),
      bass: ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.35, 0.12, 0.05])),
    },
  }
}

const CURVE_UP = Float32Array.from({ length: 24 }, (_, i) => Math.sin((i / 23) * (Math.PI / 2)))
const CURVE_DOWN = Float32Array.from({ length: 24 }, (_, i) => Math.cos((i / 23) * (Math.PI / 2)))

function osc(ctx: BaseAudioContext, type: OscillatorType | PeriodicWave, freq: number, detune: number, out: AudioNode, start: number, stop: number) {
  const o = ctx.createOscillator()
  // PeriodicWave 在类型里是个空接口，typeof 收窄不出 OscillatorType，这里手动指明
  if (typeof type === 'string') o.type = type as OscillatorType
  else o.setPeriodicWave(type)
  o.frequency.value = freq
  o.detune.value = detune
  o.connect(out)
  o.start(start)
  o.stop(stop)
}

/** 持续音的包络：线性起音，保持到 hold，再指数释音 */
function sustain(ctx: BaseAudioContext, out: AudioNode, when: number, attack: number, hold: number, release: number, peak: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(peak, when + Math.min(attack, hold))
  g.gain.setValueAtTime(peak, when + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, when + hold + release)
  g.connect(out)
  return g
}

/** 拨弦式包络：瞬间起音，然后一路指数衰减 */
function pluck(ctx: BaseAudioContext, out: AudioNode, when: number, peak: number, decay: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(peak, when + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
  g.connect(out)
  return g
}

function noiseHit(ctx: BaseAudioContext, bus: Bus, dest: AudioNode, when: number, peak: number, decay: number, seed: number) {
  const src = ctx.createBufferSource()
  src.buffer = bus.noise
  src.loop = true
  src.connect(pluck(ctx, dest, when, peak, decay))
  src.start(when, (seed * 7.31) % 1.5)
  src.stop(when + decay + 0.03)
}

export function playNote(bus: Bus, n: Note, when: number, dur: number, resumed: boolean) {
  const ctx = bus.ctx
  const f = mtof(n.midi)
  const v = n.vel
  switch (n.voice) {
    case 'pad': {
      // 等功率交叉淡入淡出：一个和弦淡出的同时，下一个淡入，总音量不起伏
      const fade = resumed ? 0.06 : Math.min(PAD_FADE, dur * 0.5)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, when)
      g.gain.setValueCurveAtTime(CURVE_UP.map((c) => c * LEVEL.pad * v), when, fade)
      g.gain.setValueCurveAtTime(CURVE_DOWN.map((c) => c * LEVEL.pad * v), when + dur, PAD_FADE)
      g.connect(bus.pad)
      // 两把略微走音的三角波叠在一起：厚一点，也不会每小节都“同相”
      const spread = 5 + ((n.t * 13 + n.midi) % 4)
      osc(ctx, 'triangle', f, -spread, g, when, when + dur + PAD_FADE)
      osc(ctx, 'triangle', f, spread, g, when, when + dur + PAD_FADE)
      break
    }
    case 'bass':
      osc(ctx, bus.wave.bass, f, 0, sustain(ctx, bus.bass, when, 0.012, dur, 0.14, LEVEL.bass * v), when, when + dur + 0.14)
      break
    case 'arp': {
      const decay = dur * 1.3 + 0.12
      osc(ctx, bus.wave.mid, f, 0, pluck(ctx, n.pan < 0 ? bus.arp[0] : bus.arp[1], when, LEVEL.arp * v, decay), when, when + decay + 0.03)
      break
    }
    case 'lead':
      osc(ctx, bus.wave.thin, f, 0, sustain(ctx, bus.lead, when, 0.012, dur, 0.12, LEVEL.lead * v), when, when + dur + 0.12)
      break
    case 'bell':
      osc(ctx, 'sine', f, 0, pluck(ctx, bus.bell, when, LEVEL.bell * v, 1), when, when + 1.05)
      osc(ctx, 'sine', f * 2.76, 0, pluck(ctx, bus.bell, when, LEVEL.bell * 0.35 * v, 0.35), when, when + 0.4)
      break
    case 'kick': {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(150, when)
      o.frequency.exponentialRampToValueAtTime(46, when + 0.12)
      o.connect(pluck(ctx, bus.kit, when, LEVEL.kick * v, 0.26))
      o.start(when)
      o.stop(when + 0.3)
      break
    }
    case 'snare': {
      noiseHit(ctx, bus, bus.snare, when, LEVEL.snare * v, 0.11, n.t)
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(210, when)
      o.frequency.exponentialRampToValueAtTime(130, when + 0.08)
      o.connect(pluck(ctx, bus.kit, when, LEVEL.snare * 0.6 * v, 0.08))
      o.start(when)
      o.stop(when + 0.12)
      break
    }
    case 'hat':
      noiseHit(ctx, bus, bus.hat, when, LEVEL.hat * v, n.dur, n.t)
      break
    case 'swell': {
      const src = ctx.createBufferSource()
      src.buffer = bus.noise
      src.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.3
      bp.frequency.setValueAtTime(350, when)
      bp.frequency.exponentialRampToValueAtTime(6500, when + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(0.16 * v, when + dur)
      g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.06)
      src.connect(bp).connect(g).connect(bus.kit)
      src.start(when, (n.t * 7.31) % 1.5)
      src.stop(when + dur + 0.08)
      break
    }
    case 'boom': {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(66, when)
      o.frequency.exponentialRampToValueAtTime(34, when + 1)
      o.connect(pluck(ctx, bus.kit, when, 0.6 * v, 1.8))
      o.start(when)
      o.stop(when + 1.85)
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 2500
      hp.connect(bus.kit)
      noiseHit(ctx, bus, hp, when, 0.1 * v, 1.3, n.t)
      break
    }
  }
}

// ── 网页实时播放 ──────────────────────────────────
/** 往前预约多久（秒）：页面卡一下也不会断音 */
const AHEAD = 1.2
/** 时间轴和音频时钟差超过这么多（拖了进度条 / 页面卡过），就从当前位置重新对齐 */
const DRIFT = 0.3

/**
 * 网页里的配乐播放器：跟着时间轴往前预约音符。
 * 暂停 / 拖动 / 漂移时，把已经预约的那一批整体淡出，再从新位置重新开始。
 */
export class LiveScore {
  private bus: Bus | null = null
  private anchorCtx = 0
  private anchorT = 0
  private upto = 0
  private readonly ctx: AudioContext
  private readonly dest: AudioNode
  private readonly score: Score

  constructor(ctx: AudioContext, dest: AudioNode, score: Score) {
    this.ctx = ctx
    this.dest = dest
    this.score = score
  }

  /** t：时间轴当前时间；playing：是否正在正向播放（暂停、拖动中、静音都算 false） */
  sync(t: number, playing: boolean) {
    if (!playing) return this.stop()
    const now = this.ctx.currentTime
    if (this.bus && Math.abs(t - (this.anchorT + now - this.anchorCtx)) > DRIFT) this.stop()
    let fresh = false
    if (!this.bus) {
      this.bus = createBus(this.ctx, this.dest)
      this.anchorCtx = now + 0.06 // 留一点余量，让第一批音符来得及排进去
      this.anchorT = t
      this.upto = t
      fresh = true
    }
    const until = this.anchorT + (now - this.anchorCtx) + AHEAD
    if (until <= this.upto) return
    this.score.play(this.bus, this.score.range(this.upto, until, fresh), this.anchorCtx, this.anchorT)
    this.upto = until
  }

  stop() {
    const bus = this.bus
    if (!bus) return
    this.bus = null
    bus.gate.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04)
    window.setTimeout(() => bus.gate.disconnect(), 600)
  }
}
