import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const BOOKS_DIR = path.join(ROOT, 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const CRAWL_FILE = path.join(ROOT, '.crawl-jisge-all.json')
const RE_FILE = path.join(ROOT, '.recrawl-progress.json')
const DASHBOARD_HTML = path.join(ROOT, 'crawler-dashboard.html')

function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }

let cachedData = null
let cacheTime = 0
const CACHE_TTL = 2000

function getProcessStatus() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8', timeout: 3000 })
    const n = out.trim().split('\n').filter(l => l.includes('node.exe')).length
    return { nodeProcesses: n, running: n > 1 }
  } catch { return { nodeProcesses: 0, running: false } }
}

function generateData() {
  const now = Date.now()
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData

  const crawl = loadJSON(CRAWL_FILE, { allBooks: [], crawled: [], failed: [], discovered: [] })
  const recrawl = loadJSON(RE_FILE, { done: [] })
  const idx = loadJSON(INDEX_FILE, [])
  const jisge = idx.filter(b => b.sourceId === 'jisge')
  const proc = getProcessStatus()

  let totalSize = 0, fileCount = 0
  try {
    for (const f of fs.readdirSync(BOOKS_DIR)) {
      if (f.endsWith('.json') && f !== 'index.json') {
        totalSize += fs.statSync(path.join(BOOKS_DIR, f)).size
        fileCount++
      }
    }
  } catch {}

  const crawledSet = new Set(crawl.crawled || [])
  const failedSet = new Set(crawl.failed || [])
  const allBooks = crawl.allBooks || []

  const bookStats = []
  let totalWords = 0, totalLines = 0, emptyChapters = 0
  let descClean = 0, descDirty = 0
  const chCountDist = {}

  // Only scan up to 500 books for stats to keep fast
  const scanLimit = Math.min(jisge.length, 500)
  for (let bi = 0; bi < scanLimit; bi++) {
    const b = jisge[bi]
    try {
      const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, b.id + '.json'), 'utf8'))
      const ch = book.chapters ? book.chapters.length : 0
      let contentLen = 0, quoteIssues = 0, words = 0, lines = 0, emptyCh = 0
      for (const c of (book.chapters || [])) {
        const cl = c.content ? c.content.length : 0
        contentLen += cl
        if (cl === 0) emptyCh++
        if (c.content) {
          const ls = c.content.split('\n')
          lines += ls.length
          words += c.content.replace(/\s/g, '').length
          for (const l of ls) {
            const qi = l.indexOf('\u201c')
            if (qi >= 0 && l.slice(qi + 1).trim().length === 0) quoteIssues++
          }
        }
      }
      totalWords += words; totalLines += lines; emptyChapters += emptyCh
      if (b.description && (b.description.includes('返回') || b.description.includes('\n'))) descDirty++
      else descClean++
      const bucket = ch === 0 ? '0' : ch <= 5 ? '1-5' : ch <= 10 ? '6-10' : ch <= 20 ? '11-20' : ch <= 50 ? '21-50' : ch <= 100 ? '51-100' : '100+'
      chCountDist[bucket] = (chCountDist[bucket] || 0) + 1

      const webBook = allBooks.find(w => w.title === b.title)
      const crawlStatus = crawledSet.has(webBook?.id) ? 'crawled' : failedSet.has(webBook?.id) ? 'failed' : webBook ? 'pending' : 'no_mapping'

      bookStats.push({
        id: b.id, title: b.title, chapters: ch, contentLen, quoteIssues,
        words, lines, emptyChapters: emptyCh,
        desc: (b.description || '').slice(0, 60),
        isLong: webBook?.isLong ?? (ch > 1),
        crawlStatus, webId: webBook?.id || '',
        avgChapterLen: ch > 0 ? Math.round(contentLen / ch) : 0
      })
    } catch {}
  }
  bookStats.sort((a, b) => b.chapters - a.chapters)

  const recentBooks = []
  try {
    const files = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json')
    const withTime = files.slice(-20).map(f => {
      const st = fs.statSync(path.join(BOOKS_DIR, f))
      return { file: f, mtime: st.mtimeMs, size: st.size }
    }).sort((a, b) => b.mtime - a.mtime)
    for (const ft of withTime) {
      try {
        const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, ft.file), 'utf8'))
        recentBooks.push({ id: book.id, title: book.title, chapters: book.chapters?.length || 0, size: ft.size, modified: new Date(ft.mtime).toISOString() })
      } catch {}
    }
  } catch {}

  cachedData = {
    crawl: {
      phase: crawl.phase, allBooks: allBooks.length,
      crawled: (crawl.crawled || []).length, failed: (crawl.failed || []).length,
      pending: allBooks.length - (crawl.crawled || []).length - (crawl.failed || []).length,
      discovered: (crawl.discovered || []).length,
      longBooks: allBooks.filter(b => b.isLong).length,
      shortStoryBooks: allBooks.filter(b => !b.isLong).length
    },
    recrawl: { done: (recrawl.done || []).length, total: 0 },
    index: { total: idx.length, jisge: jisge.length, other: idx.length - jisge.length },
    stats: {
      totalChapters: bookStats.reduce((s, b) => s + b.chapters, 0),
      totalContent: bookStats.reduce((s, b) => s + b.contentLen, 0),
      totalWords, totalLines, emptyChapters,
      shortBooks: bookStats.filter(b => b.chapters < 20).length,
      completeBooks: bookStats.filter(b => b.chapters >= 20).length,
      quoteIssueBooks: bookStats.filter(b => b.quoteIssues > 0).length,
      totalQuoteIssues: bookStats.reduce((s, b) => s + b.quoteIssues, 0),
      descClean, descDirty,
      avgChaptersPerBook: scanLimit > 0 ? (bookStats.reduce((s, b) => s + b.chapters, 0) / scanLimit).toFixed(1) : 0,
      avgContentPerBook: scanLimit > 0 ? Math.round(bookStats.reduce((s, b) => s + b.contentLen, 0) / scanLimit) : 0,
      medianChapters: (() => { const sorted = bookStats.map(b => b.chapters).sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] || 0 })(),
      maxChapters: bookStats.length > 0 ? bookStats[0].chapters : 0,
      maxChaptersBook: bookStats.length > 0 ? bookStats[0].title : '',
      scanLimit
    },
    chCountDist,
    process: proc,
    fileStat: { fileCount, totalSize },
    recentBooks,
    books: bookStats,
    updatedAt: new Date().toISOString()
  }
  cacheTime = now
  return cachedData
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(generateData()))
  } else if (req.url === '/' || req.url === '/crawler-dashboard.html' || req.url.startsWith('/crawler-dashboard.html?')) {
    const html = fs.readFileSync(DASHBOARD_HTML, 'utf8')
    const data = generateData()
    const injected = html.replace(
      'async function loadData() {',
      `const __embedded = ${JSON.stringify(data)};\nasync function loadData() {`
    ).replace(
      "const resp = await fetch('/api/data?t=' + Date.now());\n    data = await resp.json();",
      "data = __embedded;"
    )
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' })
    res.end(injected)
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(8080, '127.0.0.1', () => {
  console.log('🕷️ 爬虫监控面板: http://127.0.0.1:8080')
  console.log('   API: http://127.0.0.1:8080/api/data')
  console.log('   缓存TTL: 2秒 | 扫描上限: 500本')
})
