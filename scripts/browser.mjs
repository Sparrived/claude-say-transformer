// 用本机已安装的 Edge / Chrome（无头模式）打开动画页面
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

/** 启动无头浏览器；viewport 是新标签页的默认大小 */
export async function launchBrowser(viewport = { width: 1920, height: 1080 }) {
  const executablePath = CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) throw new Error('找不到 Edge / Chrome，可以用环境变量 BROWSER 指定浏览器路径')
  return puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { ...viewport, deviceScaleFactor: 1 },
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'],
  })
}

export async function openMovie(url) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.__movie, { timeout: 60000, polling: 200 })
  const info = await page.evaluate(() => ({ duration: window.__movie.duration, chapters: window.__movie.chapters }))
  return { browser, page, ...info }
}
