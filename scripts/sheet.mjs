// 把 shots/ 里的截图每 4 张拼成一张 2×2 的总览图：node scripts/sheet.mjs
import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const dir = process.env.OUT ?? 'shots'
const files = readdirSync(dir)
  .filter((f) => /^t[\d.]+\.png$/.test(f))
  .sort()
for (let i = 0; i < files.length; i += 4) {
  const group = files.slice(i, i + 4)
  while (group.length < 4) group.push(group[group.length - 1])
  const out = `${dir}/sheet-${String(i / 4 + 1).padStart(2, '0')}.png`
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    ...group.flatMap((f) => ['-i', `${dir}/${f}`]),
    '-filter_complex', '[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0,scale=1920:1080',
    out,
  ])
  console.log(out, '←', group.join(' '))
}
