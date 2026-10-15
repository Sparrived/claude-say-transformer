// 配色取自 Claude Code 自己的深色主题，每种颜色在片中都有固定含义
export const C = {
  ink: '#1F1E1D', // 终端底色（Claude 深色界面）
  ink2: '#292826',
  ink3: '#34322F',
  line: '#46433E',
  fg: '#EEEAE2',
  dim: '#9A958B',
  faint: '#625E57',
  clawd: '#D77757', // Clawd 本体 / 注意力权重
  clawdHi: '#EB9F7F', // claudeShimmer
  q: '#B1B9F9', // Query：“我在找什么”（Claude Code 的 permission 色）
  k: '#4EBA65', // Key：“我是什么”（success 色）
  v: '#FFC107', // Value：“我能提供什么”（warning 色）
  red: '#FF6B80',
  teal: '#48968C',
  pink: '#FD5DB1',
  purple: '#AF87FF',
  prompt: '#888888',
} as const

/** 线性混合两个 #rrggbb 颜色 */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p: number, shift: number) => (p >> shift) & 255
  const out = [16, 8, 0].map((sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t))
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('')
}
