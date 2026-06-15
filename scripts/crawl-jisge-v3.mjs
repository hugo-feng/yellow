import puppeteer from 'puppeteer-core'
import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.crawl-jisge-all.json')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CONCURRENCY = 3
const PAGE_TIMEOUT = 25000
const CH_TIMEOUT = 15000
const BASE = 'https://jishuge.one'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
function saveJSON(f, d) {
  const tmp = f + '.tmp'
  try { fs.writeFileSync(tmp, JSON.stringify(d, null, 2)); fs.renameSync(tmp, f) }
  catch { try { fs.writeFileSync(f, JSON.stringify(d, null, 2)) } catch {} }
}

function cleanText(t) {
  if (!t) return ''
  return t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, '\n')
    .replace(/请收藏本站.*?$/gm, '').replace(/最快更新.*?$/gm, '').replace(/一秒记住.*?$/gm, '')
    .replace(/天才一秒.*?$/gm, '').replace(/手机阅读.*?$/gm, '').replace(/本章未完.*?$/gm, '')
    .replace(/章节错误.*?$/gm, '').replace(/点此报错.*?$/gm, '')
    .replace(/来源\s*$/gm, '').replace(/https?:\/\/\S+/g, '')
    .replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '')
    .replace(/\(本章完\)/g, '')
    .replace(/请收藏.*?$/gm, '').replace(/最新章节.*?$/gm, '')
    .replace(/[\u200b\u200c\u200d\ufeff\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .trim()
}

function extractChapterNum(title) {
  const m = title.match(/第\s*(\d+)\s*章/)
  if (m) return parseInt(m[1], 10)
  const m2 = title.match(/(\d+)/)
  if (m2) return parseInt(m2[1], 10)
  return 0
}

function getNextBookId() {
  const existing = fs.readdirSync(BOOKS_DIR)
    .filter(f => f.startsWith('book_') && f.endsWith('.json'))
    .map(f => parseInt(f.replace('book_', '').replace('.json', ''), 10))
    .filter(n => !isNaN(n))
  return existing.length > 0 ? Math.max(...existing) + 1 : 1
}

// Puppeteer-based page fetcher with retry
async function fetchPage(browser, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const page = await browser.newPage()
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })
      await sleep(1000 + Math.random() * 1000)
      const html = await page.content()
      await page.close()
      return html
    } catch (e) {
      await page.close().catch(() => {})
      if (attempt === retries) throw e
      await sleep(2000 * attempt + Math.random() * 2000)
    }
  }
  throw new Error('Max retries exceeded')
}

function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
           '--disable-extensions', '--disable-background-networking',
           '--dns-prefetch-disable=false']
  })
}

// Parse list page to discover books
function parseListPage(html) {
    const doc = new JSDOM(html).window.document
  const results = []
  const items = doc.querySelectorAll('ul.ucontent li a')
  items.forEach(a => {
    const href = a.getAttribute('href') || ''
    const title = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
    const desc = a.querySelector('.description')?.textContent?.trim() || ''
    if (href && title) {
      const id = href.replace(/^\//, '').replace(/\.html$/, '')
      results.push({ id, title, description: desc, isLong: id.startsWith('contentlist_') })
    }
  })
  return results
}

// Parse book page - get chapter list (for long stories) or content (for short stories)
async function parseBookPage(browser, bookId) {
  const url = `${BASE}/${bookId}.html`
  const html = await fetchPage(browser, url)
  const doc = new JSDOM(html).window.document

  const title = doc.querySelector('.content-title div:last-child, .book-title, h1')?.textContent?.trim() || ''

  // Check if it's a short story with inline content
  if (doc.querySelector('#bookcontent p')) {
    const content = extractContent(doc)
    if (content.length > 20) {
      return { title, chapters: [{ id: 'ch1', title: title || '正文', index: 0, url: '', content }], isShort: true }
    }
  }

  // Long story - get chapter list with pagination
  const allChLinks = []
  const firstLinks = parseChapterLinks(doc)
  allChLinks.push(...firstLinks)

  // Check pagination
  const maxPage = (() => {
    const pageEl = doc.querySelector('.stui-page .num')
    if (pageEl) {
      const m = pageEl.textContent.match(/\/(\d+)/)
      if (m) return parseInt(m[1], 10)
    }
    return 1
  })()

  if (maxPage > 1) {
    for (let pg = 2; pg <= maxPage; pg++) {
      try {
        const pageUrl = `${BASE}/${bookId}_${pg}.html`
        const pageHtml = await fetchPage(browser, pageUrl)
        const pageDoc = new JSDOM(pageHtml).window.document
        allChLinks.push(...parseChapterLinks(pageDoc))
      } catch {}
      await sleep(300 + Math.random() * 300)
    }
  }

  // Deduplicate
  const seen = new Set()
  const uniqueLinks = allChLinks.filter(l => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  })

  return { title, chapters: uniqueLinks.map((l, i) => ({ id: l.href.replace(/^\//, '').replace(/\.html$/, ''), title: l.title, index: i, url: l.href })), isShort: false }
}

function parseChapterLinks(doc) {
  const links = []
  doc.querySelectorAll('ul.ucontent li a').forEach(a => {
    const href = a.getAttribute('href') || ''
    const title = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
    if (href && title) links.push({ href, title })
  })
  return links
}

function extractContent(doc) {
  const el = doc.querySelector('#bookcontent')
  if (!el) return ''
  let h = el.innerHTML
  h = h.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
  h = h.replace(/<[^>]+>/g, '')
  const ta = doc.createElement('textarea')
  ta.innerHTML = h
  return cleanText(ta.value.replace(/\n{3,}/g, '\n\n'))
}

// Crawl a single chapter
async function crawlChapter(browser, chUrl) {
  const url = chUrl.startsWith('http') ? chUrl : `${BASE}${chUrl.startsWith('/') ? '' : '/'}${chUrl}`
  const html = await fetchPage(browser, url, 2)
  const { JSDOM } = await import('jsdom')
  const doc = new JSDOM(html).window.document
  return extractContent(doc)
}

// Main crawl function for a single book
async function crawlBook(browser, bookInfo, bookId) {
  const detail = await parseBookPage(browser, bookInfo.id)

  if (!detail.title || detail.chapters.length === 0) return null

  let chapters = []
  if (detail.isShort) {
    chapters = detail.chapters
  } else {
    // Crawl each chapter
    for (const ch of detail.chapters) {
      try {
        const content = await crawlChapter(browser, ch.url)
        if (content && content.length > 20) {
          chapters.push({ ...ch, content })
        }
      } catch {}
      await sleep(200 + Math.random() * 300)
    }
    // Sort by chapter number
    chapters.sort((a, b) => extractChapterNum(a.title) - extractChapterNum(b.title))
    chapters.forEach((ch, i) => { ch.index = i })
  }

  if (chapters.length === 0) return null

  const book = {
    id: `book_${bookId}`,
    title: detail.title,
    author: '未知',
    cover: '',
    description: bookInfo.description || `${detail.title} - 集书阁`,
    sourceId: 'jisge',
    sourceName: '集书阁',
    chapters,
    tags: guessTags(detail.title + ' ' + (bookInfo.description || ''))
  }

  return book
}

function guessTags(text) {
  const tagMap = {
    '玄幻': ['玄幻','奇幻'], '都市': ['都市','现代'], '修仙': ['修仙','仙侠'], '重生': ['重生'],
    '穿越': ['穿越','异世'], '言情': ['言情','爱情'], '科幻': ['科幻','未来'], '历史': ['历史','古代'],
    '武侠': ['武侠','江湖'], '悬疑': ['悬疑','推理'], '末世': ['末世','废土'], '灵异': ['灵异','恐怖'],
    '军事': ['军事','战争'], '网游': ['网游','游戏'], '校园': ['校园','青春'], '仙侠': ['仙侠','修真'],
    '奇幻': ['奇幻','魔法'], '赘婿': ['赘婿','逆袭'], '系统': ['系统','穿越'], '快穿': ['快穿','穿越'],
    '盗墓': ['盗墓','探险'], '种田': ['种田','田园'], '女强': ['女强','言情'], '古言': ['古言','古代'],
    '现言': ['现言','现代'], '洪荒': ['洪荒','封神'], '西游': ['西游','神话']
  }
  const tags = new Set()
  for (const [key, vals] of Object.entries(tagMap)) {
    if (text.includes(key)) vals.forEach(t => tags.add(t))
  }
  return tags.size > 0 ? [...tags].slice(0, 3) : ['其他']
}

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  集书阁 Puppeteer 全量爬虫 v3`)
  console.log(`  并发: ${CONCURRENCY} | 超时: ${PAGE_TIMEOUT}ms`)
  console.log(`${'='.repeat(60)}\n`)

  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true })

  const progress = loadJSON(PROGRESS_FILE, { phase: 'discover', allBooks: [], crawled: [], failed: [] })
  const existingIndex = loadJSON(INDEX_FILE, [])
  const existingTitles = new Set(existingIndex.map(b => b.title))
  let bookId = getNextBookId()

  let browser = await launchBrowser()

  // Phase 1: Discover all book URLs from list pages
  const LISTS = [
    { id: 1, name: '短篇情色小说', maxPage: 520 },
    { id: 2, name: '长篇情色小说', maxPage: 11 },
  ]

  if (progress.phase === 'discover' || (progress.allBooks || []).length === 0) {
    console.log('📋 阶段1: 发现所有书籍链接...\n')

    if (!progress.allBooks) progress.allBooks = []

    for (const list of LISTS) {
      console.log(`  📂 ${list.name} (${list.maxPage} 页)`)
      for (let page = 1; page <= list.maxPage; page++) {
        const pageKey = `list_${list.id}_${page}`
        if ((progress.discovered || []).includes(pageKey)) continue

        const url = page === 1 ? `${BASE}/list_${list.id}.html` : `${BASE}/list_${list.id}_${page}.html`
        try {
          const html = await fetchPage(browser, url, 2)
          const { JSDOM } = await import('jsdom')
          const doc = new JSDOM(html).window.document
          const items = doc.querySelectorAll('ul.ucontent li a')
          let added = 0
          items.forEach(a => {
            const href = a.getAttribute('href') || ''
            const title = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
            const desc = a.querySelector('.description')?.textContent?.trim() || ''
            if (href && title) {
              const id = href.replace(/^\//, '').replace(/\.html$/, '')
              if (!progress.allBooks.some(x => x.id === id)) {
                progress.allBooks.push({ id, title, description: desc, isLong: id.startsWith('contentlist_') })
                added++
              }
            }
          })

          if (!progress.discovered) progress.discovered = []
          progress.discovered.push(pageKey)

          if (page % 10 === 0 || page === list.maxPage) {
            saveJSON(PROGRESS_FILE, progress)
            console.log(`    第 ${page}/${list.maxPage} 页 (+${added}, 累计 ${progress.allBooks.length})`)
          }
        } catch (e) {
          console.log(`    ❌ 第 ${page} 页: ${e.message.slice(0, 60)}`)
          // If browser died, relaunch
          try { await browser.close() } catch {}
          browser = await launchBrowser()
        }
        await sleep(300 + Math.random() * 400)
      }
    }

    progress.phase = 'crawl'
    saveJSON(PROGRESS_FILE, progress)
    console.log(`\n  ✅ 发现完毕，共 ${progress.allBooks.length} 本\n`)
  }

  // Phase 2: Crawl each book
  const allBooks = progress.allBooks || []
  const crawledSet = new Set(progress.crawled || [])
  const failedSet = new Set(progress.failed || [])
  const pending = allBooks.filter(b => !crawledSet.has(b.id) && !failedSet.has(b.id))
  let added = 0, failed = 0, skipped = 0

  console.log(`📚 阶段2: 爬取书籍 (总计 ${allBooks.length}, 已完成 ${crawledSet.size}, 待处理 ${pending.length})\n`)

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY)
    // Pre-assign unique IDs to each book in the batch
    const batchIds = batch.map((_, j) => bookId + added + skipped + failed + j)
    const results = await Promise.allSettled(
      batch.map(async (bookInfo, j) => {
        // Skip if already in index
        if (existingTitles.has(bookInfo.title)) {
          return { status: 'skipped', bookInfo }
        }

        try {
          const result = await crawlBook(browser, bookInfo, batchIds[j])
          if (!result) return { status: 'failed', bookInfo }

          // Save book
          const bookPath = path.join(BOOKS_DIR, `${result.id}.json`)
          fs.writeFileSync(bookPath, JSON.stringify(result, null, 2))
          existingIndex.push({
            id: result.id, title: result.title, author: result.author, cover: '',
            sourceId: 'jisge', sourceName: '集书阁',
            description: result.description.substring(0, 100), tags: result.tags
          })
          existingTitles.add(result.title)

          return { status: 'ok', book: result }
        } catch (e) {
          return { status: 'error', bookInfo, error: e.message }
        }
      })
    )

    // Process results
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const bookInfo = batch[j]

      if (r.status === 'fulfilled') {
        const val = r.value
        if (val.status === 'ok') {
          added++
          progress.crawled.push(bookInfo.id)
          console.log(`  💾 ${val.book.id} - ${val.book.title} (${val.book.chapters.length}章)`)
        } else if (val.status === 'skipped') {
          skipped++
          progress.crawled.push(bookInfo.id)
        } else {
          failed++
          progress.failed.push(bookInfo.id)
          if (val.error) console.log(`  ❌ ${bookInfo.title}: ${val.error.slice(0, 60)}`)
        }
      } else {
        failed++
        progress.failed.push(bookInfo.id)
        console.log(`  ❌ ${bookInfo.title}: Promise rejected`)
        // If browser died, relaunch
        try { await browser.close() } catch {}
        browser = await launchBrowser()
      }
    }

    saveJSON(INDEX_FILE, existingIndex)

    const total = crawledSet.size + added + failed + skipped
    if (total % 20 === 0 || i + CONCURRENCY >= pending.length) {
      saveJSON(PROGRESS_FILE, progress)
      const pct = (total / allBooks.length * 100).toFixed(1)
      console.log(`  [进度] ${total}/${allBooks.length} (${pct}%) | 新增:${added} 跳过:${skipped} 失败:${failed} | 总计:${existingIndex.length}`)
    }

    await sleep(200 + Math.random() * 300)
  }

  saveJSON(PROGRESS_FILE, progress)
  try { await browser.close() } catch {}

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ✅ 完成！新增: ${added} | 跳过: ${skipped} | 失败: ${failed} | 总计: ${existingIndex.length}`)
  console.log(`${'='.repeat(60)}\n`)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
