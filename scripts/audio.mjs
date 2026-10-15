// 只重做音轨，再封装进已有的 MP4：不用重新逐帧截图（整片渲染要好几分钟，改配乐不该再等一遍）。
//   npm run audio                               → out/clawd-transformer.mp4 换上新音轨，存成 out/clawd-transformer-music.mp4
//   npm run audio -- --video a.mp4 --out b.mp4
//   npm run audio -- --no-music                 只留音效（和有配乐的版本对比用）
//   npm run audio -- --wav out/music.wav --only music     只导出 WAV（music / sfx），方便单独试听、分析；不碰视频
//
// 视频帧是按当时的动画渲染的，音轨必须和它同一版动画：如果之后改过动画时长，
// 这里会因为“视频时长 ≠ 当前动画时长”而拒绝封装，提示重新 npm run render。
import { execFileSync, spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'
import { openMovie } from './browser.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const video = opt('video', 'out/clawd-transformer.mp4')
const out = opt('out', video.replace(/\.mp4$/i, '-music.mp4'))
const wavOut = opt('wav')
const only = opt('only') // 'music' | 'sfx' | 未指定 = 两者都要
const noMusic = args.includes('--no-music') || only === 'sfx'
const noSfx = only === 'music'
if (only && !['music', 'sfx'].includes(only)) throw new Error(`--only 只能是 music 或 sfx，收到 ${only}`)

const wavPath = resolve(wavOut ?? 'out/_audio/audio.wav')
mkdirSync(dirname(wavPath), { recursive: true })

const server = await createServer({
  server: { port: 5199, strictPort: false, watch: { ignored: ['**/out/**'] } },
  logLevel: 'warn',
})
await server.listen()
const url = server.resolvedUrls.local[0]

const flags = ['render', noMusic && 'music=0', noSfx && 'sfx=0'].filter(Boolean).join('&')
const movie = await openMovie(`${url}?${flags}`)
try {
  let videoDuration = 0
  if (!wavOut) {
    videoDuration = Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }),
    )
    if (Math.abs(videoDuration - movie.duration) > 0.15) {
      throw new Error(
        `视频时长 ${videoDuration.toFixed(2)}s，当前动画 ${movie.duration.toFixed(2)}s：动画改过了，音轨对不上，请先 npm run render 重新导出视频`,
      )
    }
  }

  console.log(`渲染音轨（${noSfx ? '仅配乐' : noMusic ? '仅音效' : '音效 + 配乐'}，${movie.duration.toFixed(1)}s）…`)
  const t0 = Date.now()
  const size = await movie.page.evaluate(() => window.__movie.prepareAudio())
  const stream = createWriteStream(wavPath)
  const CHUNK = 4 << 20
  for (let o = 0; o < size; o += CHUNK) {
    const b64 = await movie.page.evaluate((a, b) => window.__movie.audioChunk(a, b), o, CHUNK)
    if (!stream.write(Buffer.from(b64, 'base64'))) await new Promise((r) => stream.once('drain', r))
  }
  await new Promise((r) => stream.end(r))
  console.log(`音轨 ${(size / 1048576).toFixed(1)} MB，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s → ${wavPath}`)

  if (!wavOut) {
    mkdirSync(dirname(resolve(out)), { recursive: true })
    console.log('封装中（视频流直接拷贝，不重新编码）…')
    const ff = spawn(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error',
        '-i', video, '-i', wavPath,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-t', videoDuration.toFixed(3),
        '-movflags', '+faststart',
        out,
      ],
      { stdio: 'inherit' },
    )
    await new Promise((res, rej) => {
      ff.on('error', rej)
      ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg 退出码 ${c}`))))
    })
    rmSync(dirname(wavPath), { recursive: true, force: true })
    console.log(`完成：${out}`)
  }
} finally {
  await movie.browser.close().catch(() => {})
  await server.close()
}
