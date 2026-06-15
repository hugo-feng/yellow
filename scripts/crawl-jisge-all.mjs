import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const URLS_FILE = path.join(__dirname, '..', '.jisge-all-urls.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.crawl-jisge-all-progress.json')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CONCURRENCY = 5
const PAGE_TIMEOUT = 20000
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }
function saveJSON(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)) }

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

async function crawlBook(browser, bookUrl, existingIndex, existingTitles, bookId) {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

  try {
    await page.goto(bookUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })
    await sleep(1000)

    const detail = await page.evaluate(() => {
      const titleEl = document.querySelector('.content-title div:last-child, .book-title, h1')
      const title = titleEl?.textContent?.trim() || ''
      const chapters = []

      if (document.querySelector('#bookcontent p')) {
        const paragraphs = document.querySelectorAll('#bookcontent p')
        const lines = []
        paragraphs.forEach(p => {
          let text = (p.textContent || '').replace(/来源[：:]\s*\S+/g, '').replace(/来源\s*$/g, '').replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '').replace(/请收藏.*?$/gm, '').replace(/https?:\/\/\S+/g, '').trim()
          if (text.length > 2) lines.push(text)
        })
        if (lines.length > 0) {
          chapters.push({ id: 'ch1', title: title || '正文', index: 0, url: '', content: lines.join('\n') })
        }
        return { title, chapters, type: 'short' }
      }

      const chLinks = document.querySelectorAll('ul.ucontent li a')
      chLinks.forEach((a, i) => {
        const chHref = a.getAttribute('href') || ''
        const chTitle = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
        if (chHref && chTitle) {
          chapters.push({ id: chHref.replace(/^\//, '').replace(/\.html$/, ''), title: chTitle, index: i, url: chHref })
        }
      })
      return { title, chapters, type: chapters.length > 0 ? 'multi' : 'none' }
    })

    if (!detail.title || detail.type === 'none') return null

    if (existingTitles.has(detail.title)) return null

    let chapters = []
    if (detail.type === 'short') {
      chapters = detail.chapters
    } else {
      const MAX_CH = 200
      for (const ch of detail.chapters.slice(0, MAX_CH)) {
        try {
          const chUrl = ch.url.startsWith('http') ? ch.url : `https://jishuge.one${ch.url.startsWith('/') ? '' : '/'}${ch.url}`
          const chPage = await browser.newPage()
          await chPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
          try {
            await chPage.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })
            await sleep(500)
            const content = await chPage.evaluate(() => {
              const paragraphs = document.querySelectorAll('#bookcontent p')
              const lines = []
              paragraphs.forEach(p => {
                let text = (p.textContent || '').replace(/来源[：:]\s*\S+/g, '').replace(/来源\s*$/g, '').replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '').replace(/请收藏.*?$/gm, '').replace(/https?:\/\/\S+/g, '').trim()
                if (text.length > 2) lines.push(text)
              })
              return lines.join('\n')
            })
            if (content && content.length > 20) {
              chapters.push({ id: ch.id, title: ch.title, index: chapters.length, url: ch.url, content })
            }
          } catch {}
          await chPage.close()
          await sleep(200)
        } catch {}
      }
    }

    if (chapters.length === 0) return null

    const id = `book_${bookId}`
    const book = {
      id, title: detail.title, author: '未知', cover: '',
      description: `${detail.title} - 集书阁`,
      sourceId: 'jisge', sourceName: '集书阁',
      chapters, tags: guessTags(detail.title)
    }

    fs.writeFileSync(path.join(BOOKS_DIR, `${id}.json`), JSON.stringify(book, null, 2))
    existingIndex.push({ id, title: book.title, author: '未知', cover: '', sourceId: 'jisge', sourceName: '集书阁', description: book.description.substring(0, 100), tags: book.tags })
    existingTitles.add(book.title)
    saveJSON(INDEX_FILE, existingIndex)

    return { id, title: detail.title, chapters: chapters.length }
  } catch {
    return null
  } finally {
    await page.close()
  }
}

async function main() {
  const allUrls = loadJSON(URLS_FILE)
  if (!allUrls) { console.error('URLs file not found. Run collect-jisge-urls.mjs first.'); return }

  const existingIndex = loadJSON(INDEX_FILE) || []
  const existingTitles = new Set(existingIndex.map(b => b.title))

  const progress = loadJSON(PROGRESS_FILE) || { done: [] }
  const doneSet = new Set(progress.done)

  const pending = allUrls.filter(u => !doneSet.has(u))
  console.log(`📚 集书阁全量爬虫`)
  console.log(`  总URL: ${allUrls.length}`)
  console.log(`  已完成: ${progress.done.length}`)
  console.log(`  待爬取: ${pending.length}`)
  console.log(`  已有书籍: ${existingIndex.length}`)
  console.log(`  并发: ${CONCURRENCY}\n`)

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions']
  })

  let added = 0
  let skipped = 0
  let failed = 0
  let processed = 0

  try {
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      const batchIds = batch.map((_, j) => existingIndex.length + 1 + j)
      const results = await Promise.all(
        batch.map((url, j) => crawlBook(browser, url, existingIndex, existingTitles, batchIds[j]))
      )

      for (let j = 0; j < results.length; j++) {
        progress.done.push(batch[j])
        if (results[j]) {
          added++
          console.log(`  💾 ${results[j].id} - ${results[j].title} (${results[j].chapters}章)`)
        } else {
          skipped++
        }
      }

      processed += batch.length
      if (processed % 50 === 0 || i + CONCURRENCY >= pending.length) {
        saveJSON(PROGRESS_FILE, progress)
        console.log(`  [进度] ${processed}/${pending.length} | 新增:${added} 跳过:${skipped} 总计:${existingIndex.length}`)
      }

      await sleep(300)
    }
  } finally {
    saveJSON(PROGRESS_FILE, progress)
    await browser.close()
  }

  console.log(`\n========================================`)
  console.log(`  ✅ 完成！新增: ${added} | 跳过: ${skipped} | 总计: ${existingIndex.length}`)
  console.log(`========================================\n`)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
