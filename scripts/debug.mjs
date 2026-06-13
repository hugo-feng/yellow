import { writeFileSync, mkdirSync, existsSync } from 'fs'
const tmpDir = 'F:/kilo/yellow/tmp'
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

const html = await fetch('https://26b.jisge.com/list_1.html', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(8000)
}).then(r => r.text())

// Save for inspection
writeFileSync('F:/kilo/yellow/tmp/list_debug.html', html)

// Search for content links with various patterns
const patterns = [
  /content_\w+\.html/g,
  /href=["'][^"']*content_\w+\.html[^"']*["']/gi,
  /content_\w+/g
]

for (const re of patterns) {
  const ms = html.match(re) || []
  console.log(`Pattern ${re}: found ${ms.length}`)
  console.log(ms.slice(0, 5))
}

// Show some surrounding context for first match
const idx = html.indexOf('content_')
if (idx > 0) {
  console.log('--- context around first content_ ---')
  console.log(html.slice(Math.max(0, idx - 80), idx + 120))
}
