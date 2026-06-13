// Debug: test book extraction on a single known page
const BASE = 'https://26b.jisge.com'
const url = '/content_ffff9172dd0c5e22ac4210690435b1ff.html'

const html = await fetch(BASE + url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(10000)
}).then(r => r.text())

console.log('HTML length:', html.length)
console.log('Has bookcontent:', html.includes('bookcontent'))

// Test extractTitle
const titleEl = html.match(/<div class="content-title">[\s\S]*?<div[^>]*>([^<]+)<\/div>/i)
const titleFromTag = html.match(/<title>([^<]+)<\/title>/i)
console.log('Title (content-title):', titleEl ? titleEl[1].trim() : 'NOT FOUND')
console.log('Title (<title>):', titleFromTag ? titleFromTag[1].trim() : 'NOT FOUND')

// Test extractParagraphs
const ps = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
console.log('Paragraph matches:', ps.length)
if (ps.length > 0) {
  console.log('First p:', ps[0].slice(0, 200))
  console.log('Last p:', ps[ps.length-1].slice(0, 200))
}

// Test cleanContent
function cleanContent(text) {
  let t = text.replace(/<[^>]+>/g, '')
  t = t.replace(/来源[：:]\s*\S+/g, '')
    .replace(/jishuge\S*/gi, '')
    .replace(/集书阁\S*/g, '')
    .replace(/请收藏.*?$/gm, '')
    .replace(/xn--[a-z0-9-]+/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
  return t
}

const cleaned = ps.map(p => cleanContent(p)).filter(c => c.length > 5)
console.log('Cleaned paragraphs (>5 chars):', cleaned.length)
if (cleaned.length > 0) {
  console.log('Sample:', cleaned[0].slice(0, 200))
}

console.log('--- ALL PARAGRAPHS (first 10) ---')
ps.slice(0, 10).forEach((p, i) => {
  console.log(`[${i}] raw:`, p.slice(0, 100))
  console.log(`[${i}] clean:`, cleanContent(p).slice(0, 100))
})
