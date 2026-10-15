// 导出【小克学AI】视频封面（PNG）：
//   npm run cover      → out/cover-16x10.png（1920×1200，B 站封面的推荐比例）和 out/cover-16x9.png（1920×1080）
//
// 封面是 cover.html（只存在于开发服务器里，不进视频），这里用无头浏览器把它截成图。
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { launchBrowser } from './browser.mjs'

const SIZES = [
  ['16x10', 1200],
  ['16x9', 1080],
]
mkdirSync('out', { recursive: true })

const server = await createServer({
  server: { port: 5199, strictPort: false, watch: { ignored: ['**/out/**'] } },
  logLevel: 'warn',
})
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await launchBrowser({ width: 1920, height: 1200 })
try {
  for (const [name, height] of SIZES) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => console.error('[page error]', e.message))
    page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
    await page.goto(`${url}cover.html?h=${height}`, { waitUntil: 'load', timeout: 60000 })
    // 无头浏览器里默认的 rAF 轮询不会触发，换成定时轮询
    await page.waitForFunction(() => window.__coverReady === true, { timeout: 60000, polling: 200 })
    const file = `out/cover-${name}.png`
    await page.screenshot({ path: file, type: 'png' })
    console.log(`→ ${file}  (1920×${height})`)
    await page.close()
  }
} finally {
  await browser.close().catch(() => {})
  await server.close()
}
