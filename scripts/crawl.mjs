import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://26b.jisge.com'
const BOOKS_DIR = join(__dirname, '..', 'public', 'books')
const DELAY_MS = 600
const MAX_BOOKS = 40
const CONCURRENCY = 4

// 确保目录存在
for (let i = 0; i < 10; i++) {
  const dir = join(BOOKS_DIR, String(i))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

let savedCount = 0
let crawledUrls = new Set()

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      })
      if (resp.ok) return await resp.text()
      if (resp.status === 403 || resp.status === 503) {
        await sleep(3000 * (i + 1))
        continue
      }
    } catch {
      await sleep(2000 * (i + 1))
    }
  }
  return null
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function cleanContent(html) {
  let text = html.replace(/<[^>]+>/g, '')
  text = text.replace(/来源[：:]\s*\S+/g, '')
    .replace(/jishuge\S*/gi, '')
    .replace(/集书阁\S*/gi, '')
    .replace(/请收藏.*?$/gm, '')
    .replace(/xn--[a-z0-9-]+/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
  return text
}

function extractParagraphs(html) {
  const ps = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
  const lines = []
  for (const p of ps) {
    const clean = cleanContent(p)
    if (clean.length > 5) lines.push(clean)
  }
  return lines.join('\n\n')
}

function extractTitle(html) {
  const match = html.match(/<div class="content-title">[\s\S]*?<div[^>]*>([^<]+)<\/div>/i)
  if (match) return match[1].trim()
  const m2 = html.match(/<title>([^<]+)<\/title>/i)
  return m2 ? m2[1].replace(/ - 集书阁.*/, '').trim() : ''
}

async function crawlBook(url) {
  if (crawledUrls.has(url)) return null
  crawledUrls.add(url)
  
  const html = await fetchPage(BASE + url)
  if (!html) return null
  if (!html.includes('bookcontent')) return null
  
  const title = extractTitle(html)
  if (!title || title.length < 2) return null
  
  const content = extractParagraphs(html)
  if (content.length < 100) return null
  
  return {
    id: url.replace('/content_', '').replace('.html', ''),
    title,
    author: '',
    description: '来自 集书阁',
    sourceId: 'jisge',
    sourceName: '集书阁',
    format: 'html',
    downloadUrl: BASE + url,
    cached: true,
    chapters: [{
      id: 'ch1', title: '正文', index: 0, url: BASE + url, content, cached: true
    }]
  }
}

async function crawlListPage(pageNum) {
  const url = pageNum === 1 
    ? `${BASE}/list_1.html`
    : `${BASE}/list_1_${pageNum}.html`
  const html = await fetchPage(url)
  if (!html) return []
  
  const links = []
  const regex = /href="(content_\w+\.html)"/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1])
  }
  return [...new Set(links)]
}

async function saveBook(book) {
  if (!book) return
  const idx = savedCount++
  const chunk = Math.floor(idx / 100)
  const dir = join(BOOKS_DIR, String(Math.min(chunk, 9)))
  const file = join(dir, `${book.id}.json`)
  writeFileSync(file, JSON.stringify(book, null, 2), 'utf-8')
  
  if (savedCount % 50 === 0) {
    console.log(`已保存 ${savedCount} 本...`)
  }
}

async function saveIndex() {
  const allBooks = []
  for (let i = 0; i < 10; i++) {
    const dir = join(BOOKS_DIR, String(i))
    if (!existsSync(dir)) continue
    const { readdirSync, readFileSync } = await import('fs')
    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
        allBooks.push({
          id: data.id, title: data.title, author: data.author,
          description: data.description, cover: '', sourceId: data.sourceId,
          sourceName: data.sourceName, format: data.format,
          downloadUrl: data.downloadUrl,
          chapterCount: data.chapters?.length || 1
        })
      } catch {}
    }
  }
  writeFileSync(join(BOOKS_DIR, 'index.json'), JSON.stringify(allBooks, null, 2), 'utf-8')
  console.log(`索引已更新：${allBooks.length} 本书`)
}

async function main() {
  console.log('开始爬取集书阁短篇小说...')
  
  let pageLinks = []
  // 爬取前 60 页列表（每页约 20 本 = 1200 本候选）
  for (let page = 1; page <= 20; page++) {
    console.log(`获取列表第 ${page}/20 页...`)
    const links = await crawlListPage(page)
    pageLinks.push(...links)
    if (pageLinks.length >= 1500) break
    await sleep(DELAY_MS)
  }
  
  console.log(`共发现 ${pageLinks.length} 个书籍链接，开始爬取内容...`)
  
  // 并发爬取
  const queue = pageLinks.slice(0, MAX_BOOKS * 2) // 多取一些以防失败
  let idx = 0
  
  async function worker() {
    while (idx < queue.length && savedCount < MAX_BOOKS) {
      const currentIdx = idx++
      const link = queue[currentIdx]
      try {
        const book = await crawlBook(link)
        if (book) await saveBook(book)
      } catch {}
      await sleep(DELAY_MS)
    }
  }
  
  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)
  
  await saveIndex()
  console.log(`完成！共保存 ${savedCount} 本书`)
}

main().catch(console.error)
