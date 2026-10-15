// 把动画导出成 MP4（多段并行渲染）。
//   npm run render                        → out/clawd-transformer.mp4（30fps）
//   npm run render -- --fps 60
//   npm run render -- --workers 8          # 并行分段数，默认 6
//   npm run render -- --from 120 --to 150 --out out/part.mp4
//   npm run render -- --format jpeg --quality 95
//   npm run render -- --mute --keep-parts
//
// 原理：动画全部挂在同一条 GSAP 时间轴上，所以可以 seek 到任意时刻再截图。
// 整片约 1.3 万帧，单页逐帧截图约 9 分钟；这里把时间轴切成 K 段，
// 每段一个**独立浏览器进程**（同一个浏览器里开多个标签页会被后台节流，实测直接卡死），
// 各自截图 → 各自的 ffmpeg 编成一段 mp4，最后用 concat 拼接并合上音轨。
// 音轨由另一个页面在后台用 OfflineAudioContext 离线渲染，与截图并行，互不阻塞。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, createWriteStream } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'
import { openMovie } from './browser.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const fps = Number(opt('fps', 30))
const out = opt('out', 'out/clawd-transformer.mp4')
const workers = Math.max(1, Number(opt('workers', 6)))
const format = opt('format', 'png')
const quality = Number(opt('quality', 92))
const mute = args.includes('--mute')
const partsDir = resolve(opt('parts', 'out/_parts'))
mkdirSync(dirname(out), { recursive: true })
mkdirSync(partsDir, { recursive: true })

const ffmpeg = (argv, o = {}) => {
  const p = spawn('ffmpeg', argv, { stdio: 'inherit', ...o })
  return new Promise((res, rej) => {
    p.on('error', rej)
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg 退出码 ${code}`))))
  })
}

// 中间产物写在 out/ 下，别让 vite 的 watcher 去盯（会刷 EBUSY 报错）
const server = await createServer({
  server: { port: 5199, strictPort: false, watch: { ignored: ['**/out/**'] } },
  logLevel: 'warn',
})
await server.listen()
const url = server.resolvedUrls.local[0]
console.log('dev server:', url)

// ── 时长 & 分段（先开一个页面：它同时负责渲染音轨）──
const audio = await openMovie(`${url}?render`)
const { duration } = audio
const from = Number(opt('from', 0))
const to = Math.min(duration, Number(opt('to', duration)))
const total = Math.round((to - from) * fps)
const totalSeconds = total / fps
const per = Math.max(1, Math.ceil(total / workers))
const chunks = []
for (let f = 0; f < total; f += per) chunks.push({ start: f, frames: Math.min(per, total - f) })
const parts = chunks.length
console.log(`导出 ${from.toFixed(1)}s → ${to.toFixed(1)}s，${total} 帧 @ ${fps}fps，${parts} 段并行`)

let done = 0
const t0 = Date.now()
const progress = () => {
  const el = (Date.now() - t0) / 1000
  const eta = done ? (el / done) * (total - done) : 0
  process.stdout.write(`\r  截图 ${done}/${total} 帧  已用 ${el.toFixed(0)}s  剩余约 ${eta.toFixed(0)}s   `)
}
const ticker = setInterval(progress, 1000)

// ── 音轨：单独页面离线渲染，分块取回，边收边写 WAV ──
const wavPath = resolve(partsDir, 'audio.wav')
const audioJob = (async () => {
  if (mute) return 0
  const size = await audio.page.evaluate(() => window.__movie.prepareAudio())
  const stream = createWriteStream(wavPath)
  const CHUNK = 4 << 20
  for (let o = 0; o < size; o += CHUNK) {
    const b64 = await audio.page.evaluate((a, b) => window.__movie.audioChunk(a, b), o, CHUNK)
    if (!stream.write(Buffer.from(b64, 'base64'))) await new Promise((r) => stream.once('drain', r))
  }
  await new Promise((r) => stream.end(r))
  return size
})()

// ── 一段视频：逐帧 seek + 截图，直接喂给 ffmpeg 的 stdin ──
async function segment(chunk, k) {
  const file = resolve(partsDir, `part-${String(k).padStart(3, '0')}.mp4`)
  const input = format === 'png'
    ? ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-']
    : ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-']
  for (let attempt = 1; ; attempt++) {
    const m = await openMovie(`${url}?render`)
    let ff
    let code = null
    let closed = null
    let captured = 0
    try {
      ff = spawn(
        'ffmpeg',
        [
          '-y', '-loglevel', 'error',
          ...input,
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
          // 关键帧每 2s 一个，拖进度条跟手；色域标记三件套走 x264 参数才真正写进码流
          '-g', '60',
          '-color_range', 'tv', '-colorspace', 'bt709',
          '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
          file,
        ],
        { stdio: ['pipe', 'inherit', 'inherit'] },
      )
      closed = new Promise((res) => ff.on('close', (c) => ((code = c), res())))
      ff.on('error', () => {})
      // ffmpeg 若提前死掉，写入必须立刻失败：只挂 'drain' 会永久卡住整条 Promise.all
      const write = (buf) =>
        new Promise((res, rej) => {
          if (code !== null) return rej(new Error(`ffmpeg 已退出（${code}）`))
          try {
            ff.stdin.write(buf, (e) => (e ? rej(e) : res()))
          } catch (e) {
            rej(e)
          }
        })
      for (let i = 0; i < chunk.frames; i++) {
        const t = from + (chunk.start + i) / fps
        await m.page.evaluate((x) => window.__movie.seek(x), t)
        const shot = format === 'png' ? { type: 'png' } : { type: 'jpeg', quality, optimizeForSpeed: true }
        await write(await m.page.screenshot(shot))
        done++
        captured++
      }
      ff.stdin.end()
      await closed
      if (code !== 0) throw new Error(`第 ${k + 1} 段 ffmpeg 退出码 ${code}`)
      return
    } catch (e) {
      done -= captured
      if (ff && code === null) {
        ff.kill()
        await closed
      }
      if (attempt >= 2) throw e
      console.warn(`\n第 ${k + 1} 段失败（${e.message}），重试一次`)
    } finally {
      await m.browser.close().catch(() => {})
    }
  }
}

try {
  await Promise.all(chunks.map(segment))
  clearInterval(ticker)
  done = total
  progress()

  // ── 拼接 + 合音轨 ──
  // 音轨是边渲染边写盘的，必须等它写完才能读；它本来就和截图并行，这里等它不额外花时间。
  const size = await audioJob.catch((e) => {
    console.error('\n音轨渲染失败：', e.message)
    return 0
  })
  // 宁可整体失败，也不要用写到一半的 WAV 封装出一个后半段没声音的成片
  if (!mute && !size) throw new Error('音轨未生成（或只写了一半），中止封装')
  const listPath = resolve(partsDir, 'parts.txt')
  const partFiles = chunks.map((_, k) => resolve(partsDir, `part-${String(k).padStart(3, '0')}.mp4`))
  writeFileSync(listPath, partFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n')
  console.log('\n拼接中…')
  const mux = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath]
  if (!mute) mux.push('-ss', String(from), '-i', wavPath)
  mux.push(
    '-map', '0:v:0',
    ...(mute ? [] : ['-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2']),
    '-c:v', 'copy',
    '-t', totalSeconds.toFixed(3),
    '-movflags', '+faststart',
    out,
  )
  await ffmpeg(mux)
  if (size) console.log(`音轨 ${(size / 1048576).toFixed(1)} MB`)
  console.log(`完成：${out}`)
} finally {
  clearInterval(ticker)
  await audio.browser.close().catch(() => {})
  await server.close()
}
// 中间产物（分段 mp4 / wav / 清单）默认清掉，排查时用 --keep-parts 留下
if (args.includes('--keep-parts')) console.log('中间产物保留在', partsDir)
else rmSync(partsDir, { recursive: true, force: true })
