import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const CRAWL_FILE = path.join(__dirname, '..', '.crawl-jisge-all.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.recrawl-progress.json')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://jishuge.one'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
function saveJSON(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)) }

function extractChapterNum(title) {
  const m = title.match(/第\s*(\d+)\s*章/)
  if (m) return parseInt(m[1], 10)
  const m2 = title.match(/(\d+)/)
  if (m2) return parseInt(m2[1], 10)
  return 0
}

async function main() {
  const idx = loadJSON(INDEX_FILE, [])
  const crawlData = loadJSON(CRAWL_FILE, { allBooks: [] })
  const progress = loadJSON(PROGRESS_FILE, { done: [] })
  const doneSet = new Set(progress.done)

  // Build title -> website ID mapping
  const titleToWebId = new Map()
  for (const b of (crawlData.allBooks || [])) {
    if (b.id && b.title) titleToWebId.set(b.title.trim(), b.id)
  }

  // Find jisge books that need re-crawling
  const jisge = idx.filter(b => b.sourceId === 'jisge')
  const needsRecrawl = []
  for (const b of jisge) {
    if (doneSet.has(b.id)) continue
    try {
      const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, b.id + '.json'), 'utf8'))
      const chCount = book.chapters ? book.chapters.length : 0
      const webId = titleToWebId.get(b.title.trim())
      if (webId) {
        needsRecrawl.push({ localId: b.id, title: b.title, currentChapters: chCount, webId, isLong: webId.startsWith('contentlist_') })
      }
    } catch {}
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  集书阁重爬补全脚本 v2`)
  console.log(`  可映射: ${needsRecrawl.length} 本`)
  console.log(`${'='.repeat(50)}\n`)

  if (needsRecrawl.length === 0) {
    console.log('无需重爬')
    return
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })

  let fixed = 0
  let failed = 0
  let skipped = 0

  try {
    for (let i = 0; i < needsRecrawl.length; i++) {
      const bookInfo = needsRecrawl[i]
      if (doneSet.has(bookInfo.localId)) continue

      const pct = ((i + 1) / needsRecrawl.length * 100).toFixed(1)
      console.log(`[${i + 1}/${needsRecrawl.length}] (${pct}%) ${bookInfo.title} (当前${bookInfo.currentChapters}章, webId:${bookInfo.webId.slice(0,20)}...)`)

      try {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

        const bookUrl = `${BASE}/${bookInfo.webId}.html`
        await page.goto(bookUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await sleep(2000)

        if (bookInfo.isLong) {
          // Multi-chapter book - get chapter list with pagination
          const allChLinks = []
          const firstPageLinks = await page.evaluate(() => {
            const items = document.querySelectorAll('ul.ucontent li a')
            return Array.from(items).map(a => {
              const href = a.getAttribute('href') || ''
              const title = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
              return { href, title }
            }).filter(l => l.href && l.title)
          })
          allChLinks.push(...firstPageLinks)

          // Check pagination
          const maxPage = await page.evaluate(() => {
            const pageEl = document.querySelector('.stui-page .num')
            if (pageEl) {
              const m = pageEl.textContent.match(/\/(\d+)/)
              if (m) return parseInt(m[1], 10)
            }
            return 1
          })

          if (maxPage > 1) {
            for (let pg = 2; pg <= maxPage; pg++) {
              try {
                const pageUrl = `${BASE}/${bookInfo.webId}_${pg}.html`
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
                await sleep(1500)
                const pageLinks = await page.evaluate(() => {
                  const items = document.querySelectorAll('ul.ucontent li a')
                  return Array.from(items).map(a => {
                    const href = a.getAttribute('href') || ''
                    const title = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
                    return { href, title }
                  }).filter(l => l.href && l.title)
                })
                allChLinks.push(...pageLinks)
              } catch {}
              await sleep(300)
            }
          }

          await page.close()

          if (allChLinks.length <= bookInfo.currentChapters) {
            console.log(`  ⏭️ 章节数未增加 (${allChLinks.length} <= ${bookInfo.currentChapters})`)
            skipped++
            progress.done.push(bookInfo.localId)
            saveJSON(PROGRESS_FILE, progress)
            continue
          }

          // Deduplicate
          const seen = new Set()
          const uniqueLinks = allChLinks.filter(l => {
            if (seen.has(l.href)) return false
            seen.add(l.href)
            return true
          })

          console.log(`  发现 ${uniqueLinks.length} 章 (当前 ${bookInfo.currentChapters} 章)`)

          // Crawl chapters
          const chapters = []
          for (const link of uniqueLinks) {
            try {
              const chUrl = link.href.startsWith('http') ? link.href : `${BASE}${link.href.startsWith('/') ? '' : '/'}${link.href}`
              const chPage = await browser.newPage()
              await chPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
              await chPage.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
              await sleep(800)

              const content = await chPage.evaluate(() => {
                const el = document.querySelector('#bookcontent')
                if (!el) return ''
                let h = el.innerHTML
                h = h.replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
                  .replace(/<p[^>]*>/gi, '')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<div[^>]*>/gi, '\n')
                  .replace(/<\/div>/gi, '')
                h = h.replace(/<[^>]+>/g, '')
                const ta = document.createElement('textarea')
                ta.innerHTML = h
                return ta.value.replace(/\n{3,}/g, '\n\n').replace(/来源\s*$/gm, '').trim()
              })

              await chPage.close()

              if (content && content.length > 20) {
                const chId = link.href.replace(/^\//, '').replace(/\.html$/, '')
                chapters.push({ id: chId, title: link.title, index: chapters.length, url: link.href, content })
              }
            } catch {}
            await sleep(200)
          }

          // Sort by chapter number
          chapters.sort((a, b) => extractChapterNum(a.title) - extractChapterNum(b.title))
          chapters.forEach((ch, idx) => { ch.index = idx })

          if (chapters.length > bookInfo.currentChapters) {
            const bookPath = path.join(BOOKS_DIR, bookInfo.localId + '.json')
            const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'))
            bookData.chapters = chapters
            fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2))
            console.log(`  ✅ ${bookInfo.currentChapters} → ${chapters.length} 章`)
            fixed++
          } else {
            console.log(`  ⏭️ 有效章节数未增加 (${chapters.length})`)
            skipped++
          }
        } else {
          // Short story - re-crawl content with innerHTML
          const content = await page.evaluate(() => {
            const el = document.querySelector('#bookcontent')
            if (!el) return ''
            let h = el.innerHTML
            h = h.replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
              .replace(/<p[^>]*>/gi, '')
              .replace(/<\/p>/gi, '\n')
              .replace(/<div[^>]*>/gi, '\n')
              .replace(/<\/div>/gi, '')
            h = h.replace(/<[^>]+>/g, '')
            const ta = document.createElement('textarea')
            ta.innerHTML = h
            return ta.value.replace(/\n{3,}/g, '\n\n').replace(/来源\s*$/gm, '').trim()
          })
          await page.close()

          if (content && content.length > 20) {
            const bookPath = path.join(BOOKS_DIR, bookInfo.localId + '.json')
            const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'))
            bookData.chapters = [{ id: 'ch1', title: bookData.title || '正文', index: 0, url: '', content }]
            fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2))
            console.log(`  ✅ 短篇内容已更新 (${content.length} 字)`)
            fixed++
          } else {
            console.log(`  ❌ 内容为空`)
            failed++
          }
        }

        progress.done.push(bookInfo.localId)
        saveJSON(PROGRESS_FILE, progress)
      } catch (e) {
        console.log(`  ❌ 失败: ${e.message}`)
        failed++
        progress.done.push(bookInfo.localId)
        saveJSON(PROGRESS_FILE, progress)
      }

      await sleep(300)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  完成！修复: ${fixed} | 跳过: ${skipped} | 失败: ${failed}`)
  console.log(`${'='.repeat(50)}\n`)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
