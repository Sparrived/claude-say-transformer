// 截取指定时间点的画面：node scripts/snap.mjs 4.2 12 30.5
// 也可以按章节截：node scripts/snap.mjs ch:rnn+3（rnn 章开始后第 3 秒）
import { mkdirSync } from 'node:fs'
import { openMovie } from './browser.mjs'

const base = process.env.URL ?? 'http://localhost:5173/'
const out = process.env.OUT ?? 'shots'
mkdirSync(out, { recursive: true })

const { browser, page, duration, chapters } = await openMovie(`${base}?render`)
console.log(`时长 ${duration.toFixed(1)}s，共 ${chapters.length} 章`)
for (const c of chapters) console.log(`  ${c.time.toFixed(1).padStart(6)}s  ${c.id}  ${c.title}`)

for (const arg of process.argv.slice(2)) {
  let t = Number(arg)
  const m = /^ch:([\w-]+)(?:\+([\d.]+))?$/.exec(arg)
  if (m) t = chapters.find((c) => c.id === m[1]).time + Number(m[2] ?? 0)
  await page.evaluate((x) => window.__movie.seek(x), t)
  const file = `${out}/t${t.toFixed(2).padStart(7, '0')}.png`
  await page.screenshot({ path: file })
  console.log('→', file)
}
await browser.close()
