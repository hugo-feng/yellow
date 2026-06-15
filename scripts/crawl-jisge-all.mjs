import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.crawl-jisge-all.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MAX_CHAPTERS = 500
const REQ_DELAY = 300
const CH_DELAY = 200
const BASE = 'https://26b.jisge.com'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchText(url, timeout = 10000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: ctrl.signal, redirect: 'follow'
    })
    clearTimeout(timer)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    let text = new TextDecoder('utf-8').decode(buf)
    if (text.includes('�') || text.includes('\ufffd')) text = new TextDecoder('gbk').decode(buf)
    return text
  } catch (e) { clearTimeout(timer); throw e }
}

function parseDoc(html) { return new JSDOM(html).window.document }

function cleanText(t) {
  if (!t) return ''
  return t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, '\n')
    .replace(/请收藏本站.*?$/gm, '').replace(/最快更新.*?$/gm, '').replace(/一秒记住.*?$/gm, '')
    .replace(/天才一秒.*?$/gm, '').replace(/手机阅读.*?$/gm, '').replace(/本章未完.*?$/gm, '')
    .replace(/章节错误.*?$/gm, '').replace(/点此报错.*?$/gm, '')
    .replace(/来源[：:]\s*\S+/g, '').replace(/https?:\/\/\S+/g, '')
    .replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '')
    .replace(/【.*?】/g, '').replace(/\(本章完\)/g, '')
    .replace(/请收藏.*?$/gm, '').replace(/最新章节.*?$/gm, '')
    .replace(/[\u200b\u200c\u200d\ufeff\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .trim()
}

function loadJSON(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def } }
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)) }

function getNextBookId() {
  const existing = fs.readdirSync(BOOKS_DIR)
    .filter(f => f.startsWith('book_') && f.endsWith('.json'))
    .map(f => parseInt(f.replace('book_', '').replace('.json', ''), 10))
    .filter(n => !isNaN(n))
  return existing.length > 0 ? Math.max(...existing) + 1 : 1
}

function guessTags(text) {
  const tags = []
  const map = { '修仙': '修仙', '重生': '重生', '穿越': '穿越', '玄幻': '玄幻', '仙侠': '仙侠', '历史': '历史', '悬疑': '悬疑', '科幻': '科幻', '言情': '言情', '武侠': '武侠', '都市': '都市', '末世': '末世', '灵异': '灵异', '军事': '军事', '奇幻': '奇幻', '校园': '校园', '都市': '都市', '乡村': '乡村', '医生': '医生' }
  for (const [k, v] of Object.entries(map)) {
    if (text.includes(k) && !tags.includes(v)) tags.push(v)
  }
  return tags.length > 0 ? tags.slice(0, 4) : ['其他']
}

function parseListPage(html) {
  const doc = parseDoc(html)
  const results = []
  const items = doc.querySelectorAll('ul.ucontent li a')
  items.forEach(a => {
    const href = a.getAttribute('href') || ''
    const titleEl = a.querySelector('.title')
    const descEl = a.querySelector('.description')
    const title = titleEl?.textContent?.trim() || ''
    const description = descEl?.textContent?.trim() || ''
    if (href && title) {
      const id = href.replace(/^\//, '').replace(/\.html$/, '')
      const isLong = id.startsWith('contentlist_')
      results.push({ id, title, description, isLong })
    }
  })
  return results
}

function parseShortStory(html) {
  const doc = parseDoc(html)
  const titleEl = doc.querySelector('.content-title div:last-child, .book-title, h1')
  const title = titleEl?.textContent?.trim() || ''
  const paragraphs = doc.querySelectorAll('#bookcontent p')
  const lines = []
  paragraphs.forEach(p => {
    const text = cleanText(p.textContent || '')
    if (text.length > 2) lines.push(text)
  })
  const content = lines.join('\n')
  if (content.length < 20) return { title, chapters: [] }
  return { title, chapters: [{ id: 'ch1', title: title || '正文', index: 0, url: '', content }] }
}

function parseLongStory(html) {
  const doc = parseDoc(html)
  const titleEl = doc.querySelector('.content-title div:last-child, .book-title, h1')
  const title = titleEl?.textContent?.trim() || ''

  if (doc.querySelector('#bookcontent p')) {
    return parseShortStory(html)
  }

  const chapters = []
  const chLinks = doc.querySelectorAll('ul.ucontent li a')
  chLinks.forEach((a, i) => {
    const chHref = a.getAttribute('href') || ''
    const chTitle = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
    if (chHref && chTitle) {
      chapters.push({ id: chHref.replace(/^\//, '').replace(/\.html$/, ''), title: chTitle, index: i, url: chHref })
    }
  })
  return { title, chapters }
}

function parseChapterContent(html) {
  const doc = parseDoc(html)
  const paragraphs = doc.querySelectorAll('#bookcontent p')
  const lines = []
  paragraphs.forEach(p => {
    const text = cleanText(p.textContent || '')
    if (text.length > 2) lines.push(text)
  })
  return lines.join('\n')
}

function getMaxPage(html) {
  const doc = parseDoc(html)
  const pageEl = doc.querySelector('.stui-page .num')
  if (pageEl) {
    const m = pageEl.textContent.match(/\/(\d+)/)
    if (m) return parseInt(m[1], 10)
  }
  return 1
}

async function main() {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  集书阁全量爬虫 v1`)
  console.log(`  域名: ${BASE}`)
  console.log(`${'='.repeat(50)}\n`)

  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true })

  const progress = loadJSON(PROGRESS_FILE, { phase: 'discover', discovered: [], crawled: [], failed: [] })
  const existingIndex = loadJSON(INDEX_FILE, [])
  const existingTitles = new Set(existingIndex.map(b => b.title))
  let bookId = getNextBookId()
  let added = 0

  // Phase 1: Discover all book URLs from list pages
  const LISTS = [
    { id: 1, name: '短篇情色小说', maxPage: 520 },
    { id: 2, name: '长篇情色小说', maxPage: 11 },
  ]

  if (progress.phase === 'discover' || progress.discovered.length === 0) {
    console.log('📋 阶段1: 发现所有书籍链接...\n')

    for (const list of LISTS) {
      console.log(`  📂 ${list.name} (${list.maxPage} 页)`)
      for (let page = 1; page <= list.maxPage; page++) {
        const pageKey = `list_${list.id}_${page}`
        if (progress.discovered.includes(pageKey)) continue

        const url = page === 1 ? `${BASE}/list_${list.id}.html` : `${BASE}/list_${list.id}_${page}.html`
        try {
          const html = await fetchText(url, 15000)
          const books = parseListPage(html)
          for (const b of books) {
            if (!progress.crawled.includes(b.id) && !progress.failed.includes(b.id)) {
              progress.crawled // just mark as discovered
            }
          }
          progress.discovered.push(pageKey)

          if (books.length > 0) {
            const existingSet = new Set(progress.allBooks?.map(b => b.id) || [])
            if (!progress.allBooks) progress.allBooks = []
            for (const b of books) {
              if (!progress.allBooks.some(x => x.id === b.id)) {
                progress.allBooks.push(b)
              }
            }
          }

          if (page % 10 === 0 || page === list.maxPage) {
            saveJSON(PROGRESS_FILE, progress)
            console.log(`    第 ${page}/${list.maxPage} 页 (累计发现 ${progress.allBooks?.length || 0} 本)`)
          }
        } catch (e) {
          console.log(`    ❌ 第 ${page} 页失败: ${e.message}`)
          await sleep(2000)
        }
        await sleep(REQ_DELAY)
      }
    }

    progress.phase = 'crawl'
    saveJSON(PROGRESS_FILE, progress)
    console.log(`\n  ✅ 发现完毕，共 ${progress.allBooks?.length || 0} 本书\n`)
  }

  // Phase 2: Crawl each book
  const allBooks = progress.allBooks || []
  const totalBooks = allBooks.length
  let crawledCount = progress.crawled.length
  let failedCount = progress.failed.length

  console.log(`📚 阶段2: 爬取书籍内容 (共 ${totalBooks} 本，已爬 ${crawledCount}，已失败 ${failedCount})\n`)

  for (let i = 0; i < allBooks.length; i++) {
    const book = allBooks[i]
    if (progress.crawled.includes(book.id) || progress.failed.includes(book.id)) continue
    if (existingTitles.has(book.title)) {
      progress.crawled.push(book.id)
      saveJSON(PROGRESS_FILE, progress)
      continue
    }

    const pct = ((crawledCount + failedCount) / totalBooks * 100).toFixed(1)
    console.log(`[${crawledCount + failedCount + 1}/${totalBooks}] (${pct}%) ${book.title}`)

    try {
      const bookUrl = book.id.startsWith('contentlist_')
        ? `${BASE}/${book.id}.html`
        : `${BASE}/${book.id}.html`
      const bookHtml = await fetchText(bookUrl, 15000)
      let detail

      if (book.isLong) {
        detail = parseLongStory(bookHtml)
      } else {
        detail = parseShortStory(bookHtml)
      }

      if (!detail.title || detail.chapters.length === 0) {
        progress.failed.push(book.id)
        failedCount++
        saveJSON(PROGRESS_FILE, progress)
        continue
      }

      let chapters = []
      if (book.isLong && detail.chapters.length > 0 && !detail.chapters[0].content) {
        for (const ch of detail.chapters.slice(0, MAX_CHAPTERS)) {
          try {
            const chUrl = ch.url.startsWith('http') ? ch.url : `${BASE}${ch.url.startsWith('/') ? '' : '/'}${ch.url}`
            const chHtml = await fetchText(chUrl, 10000)
            const content = parseChapterContent(chHtml)
            if (content && content.length > 20) {
              chapters.push({ id: ch.id, title: ch.title, index: chapters.length, url: ch.url, content })
            }
          } catch {}
          await sleep(CH_DELAY)
        }
      } else {
        chapters = detail.chapters.slice(0, MAX_CHAPTERS)
      }

      if (chapters.length === 0) {
        progress.failed.push(book.id)
        failedCount++
        saveJSON(PROGRESS_FILE, progress)
        continue
      }

      const id = `book_${bookId}`
      const bookData = {
        id, title: detail.title, author: '未知',
        cover: '',
        description: book.description?.substring(0, 200) || `${detail.title} - 集书阁`,
        sourceId: 'jisge', sourceName: '集书阁',
        chapters, tags: guessTags(detail.title + ' ' + (book.description || ''))
      }

      fs.writeFileSync(path.join(BOOKS_DIR, `${id}.json`), JSON.stringify(bookData, null, 2))
      existingIndex.push({ id, title: bookData.title, author: bookData.author, cover: '', sourceId: 'jisge', sourceName: '集书阁', description: bookData.description.substring(0, 100), tags: bookData.tags })
      existingTitles.add(bookData.title)
      saveJSON(INDEX_FILE, existingIndex)

      progress.crawled.push(book.id)
      crawledCount++
      saveJSON(PROGRESS_FILE, progress)

      bookId++; added++
      console.log(`  💾 ${id} (${chapters.length} 章)`)
      await sleep(REQ_DELAY)
    } catch (e) {
      progress.failed.push(book.id)
      failedCount++
      saveJSON(PROGRESS_FILE, progress)
      console.log(`  ❌ 失败: ${e.message}`)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ✅ 完成！新增: ${added} | 已爬: ${crawledCount} | 失败: ${failedCount} | 总计: ${existingIndex.length}`)
  console.log(`${'='.repeat(50)}\n`)

  saveJSON(INDEX_FILE, existingIndex)
  saveJSON(PROGRESS_FILE, progress)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
