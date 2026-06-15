import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.crawl-jisge-progress.json')

const KEYWORDS = [
  '玄幻','都市','修仙','重生','穿越','言情','科幻','历史','武侠','悬疑',
  '奇幻','仙侠','末世','灵异','军事','网游','竞技','校园','官场','职场',
  '推理','恐怖','同人','轻小说','完结','热门','排行','经典','畅销','最新',
  '玄幻修真','都市异能','系统流','无敌文','赘婿','战神','医术','鉴宝',
  '种田','女强','古言','现言','快穿','无限流','盗墓','探险','架空',
  '争霸','三国','明朝','唐朝','都市生活','商战','娱乐','体育','游戏',
  '二次元','综漫','火影','海贼王','龙珠','漫威','武侠修真','洪荒',
  '封神','西游','聊斋','鬼怪','灵异事件','真实灵异','恐怖故事',
  '短篇','中篇','长篇','完本','连载','新书','精品','必读','神作',
  '排行榜','月票榜','推荐榜','收藏榜','点击榜','评分榜'
]

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const MAX_CHAPTERS = 200
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }
function saveJSON(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)) }

function guessTags(text) {
  const tagMap = {
    '玄幻': ['玄幻','奇幻','魔幻'], '都市': ['都市','现代','都市生活'],
    '修仙': ['修仙','仙侠','修真'], '重生': ['重生','逆袭'],
    '穿越': ['穿越','异世','架空'], '言情': ['言情','爱情','恋爱'],
    '科幻': ['科幻','未来','星际'], '历史': ['历史','古代','架空历史'],
    '武侠': ['武侠','江湖','武术'], '悬疑': ['悬疑','推理','探案'],
    '末世': ['末世','末日','废土'], '灵异': ['灵异','恐怖','鬼怪'],
    '军事': ['军事','战争','军旅'], '网游': ['网游','游戏','电竞'],
    '竞技': ['竞技','体育','比赛'], '校园': ['校园','青春','学生'],
    '官场': ['官场','政治','权谋'], '职场': ['职场','商战','创业'],
    '同人': ['同人','二次元','综漫'], '轻小说': ['轻小说','二次元'],
    '仙侠': ['仙侠','修真','修仙'], '奇幻': ['奇幻','魔法','异世界'],
    '赘婿': ['赘婿','逆袭','都市'], '战神': ['战神','兵王','都市'],
    '系统': ['系统','金手指','穿越'], '无敌': ['无敌','爽文','玄幻'],
    '快穿': ['快穿','穿越','言情'], '无限流': ['无限流','穿越','科幻'],
    '盗墓': ['盗墓','探险','悬疑'], '种田': ['种田','田园','生活'],
    '女强': ['女强','言情','穿越'], '古言': ['古言','古代','言情'],
    '现言': ['现言','现代','言情'], '洪荒': ['洪荒','封神','仙侠'],
    '西游': ['西游','神话','仙侠'], '封神': ['封神','神话','历史']
  }
  const tags = new Set()
  for (const [key, vals] of Object.entries(tagMap)) {
    if (text.includes(key)) vals.forEach(t => tags.add(t))
  }
  return tags.size > 0 ? [...tags].slice(0, 3) : ['其他']
}

async function main() {
  const existingIndex = loadJSON(INDEX_FILE) || []
  const existingTitles = new Set(existingIndex.map(b => b.title))
  let bookId = existingIndex.length + 1

  const progress = loadJSON(PROGRESS_FILE) || { searched: [], crawled: [] }

  console.log(`📚 集书阁爬虫 (Puppeteer版)`)
  console.log(`  已有书籍: ${existingIndex.length} 本`)
  console.log(`  已搜索关键词: ${progress.searched.length}/${KEYWORDS.length}`)
  console.log(`  已爬取: ${progress.crawled.length}\n`)

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })

  let added = 0
  let failed = 0

  try {
    for (const keyword of KEYWORDS) {
      if (progress.searched.includes(keyword)) continue

      console.log(`🔍 搜索: ${keyword}`)
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

      try {
        const searchUrl = `https://jishuge.one/list-${encodeURIComponent(keyword)}.html`
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await sleep(2000)

        const results = await page.evaluate(() => {
          const items = document.querySelectorAll('ul.ucontent li a')
          return Array.from(items).map(a => {
            const titleEl = a.querySelector('.title')
            const descEl = a.querySelector('.description')
            const href = a.getAttribute('href') || ''
            const id = href.replace(/^\//, '').replace(/\.html$/, '')
            return {
              id,
              title: titleEl?.textContent?.trim() || a.textContent?.trim() || '',
              description: descEl?.textContent?.trim() || ''
            }
          }).filter(r => r.id && r.title)
        })

        console.log(`  找到 ${results.length} 个结果`)
        progress.searched.push(keyword)
        saveJSON(PROGRESS_FILE, progress)

        for (const result of results) {
          if (existingTitles.has(result.title)) continue
          if (progress.crawled.includes(result.id)) continue

          const bookPage = await browser.newPage()
          await bookPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

          try {
            const bookUrl = result.id.includes('content_')
              ? `https://jishuge.one/${result.id}.html`
              : `https://jishuge.one/content_${result.id}.html`

            await bookPage.goto(bookUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await sleep(1500)

            const detail = await bookPage.evaluate(() => {
              const titleEl = document.querySelector('.content-title div:last-child, .book-title, h1')
              const title = titleEl?.textContent?.trim() || ''
              const chapters = []

              // Short story with inline content
              if (document.querySelector('#bookcontent p')) {
                const paragraphs = document.querySelectorAll('#bookcontent p')
                const lines = []
                paragraphs.forEach(p => {
                  let text = (p.textContent || '').replace(/来源[：:]\s*\S+/g, '').replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '').replace(/请收藏.*?$/gm, '').replace(/https?:\/\/\S+/g, '').trim()
                  if (text.length > 2) lines.push(text)
                })
                if (lines.length > 0) {
                  chapters.push({ id: 'ch1', title: title || '正文', index: 0, url: '', content: lines.join('\n') })
                }
                return { title, chapters, type: 'short' }
              }

              // Chapter list page
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

            if (!detail.title) {
              progress.crawled.push(result.id)
              saveJSON(PROGRESS_FILE, progress)
              await bookPage.close()
              continue
            }

            let chapters = []
            if (detail.type === 'short') {
              chapters = detail.chapters.slice(0, MAX_CHAPTERS)
            } else if (detail.type === 'multi') {
              for (const ch of detail.chapters.slice(0, MAX_CHAPTERS)) {
                const chPage = await browser.newPage()
                await chPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
                try {
                  const chUrl = ch.url.startsWith('http') ? ch.url : `https://jishuge.one${ch.url.startsWith('/') ? '' : '/'}${ch.url}`
                  await chPage.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
                  await sleep(1000)

                  const content = await chPage.evaluate(() => {
                    const paragraphs = document.querySelectorAll('#bookcontent p')
                    const lines = []
                    paragraphs.forEach(p => {
                      let text = (p.textContent || '').replace(/来源[：:]\s*\S+/g, '').replace(/jishuge\S*/gi, '').replace(/集书阁\S*/g, '').replace(/请收藏.*?$/gm, '').replace(/https?:\/\/\S+/g, '').trim()
                      if (text.length > 2) lines.push(text)
                    })
                    return lines.join('\n')
                  })

                  if (content && content.length > 20) {
                    chapters.push({ id: ch.id, title: ch.title, index: chapters.length, url: ch.url, content })
                  }
                } catch {}
                await chPage.close()
                await sleep(500)
              }
            }

            if (chapters.length === 0) {
              progress.crawled.push(result.id)
              saveJSON(PROGRESS_FILE, progress)
              await bookPage.close()
              continue
            }

            const id = `book_${bookId}`
            const book = {
              id, title: detail.title, author: '未知',
              cover: '',
              description: result.description?.substring(0, 200) || `${detail.title} - 集书阁`,
              sourceId: 'jisge', sourceName: '集书阁',
              chapters, tags: guessTags(detail.title + ' ' + (result.description || ''))
            }

            fs.writeFileSync(path.join(BOOKS_DIR, `${id}.json`), JSON.stringify(book, null, 2))
            existingIndex.push({ id, title: book.title, author: book.author, cover: '', sourceId: 'jisge', sourceName: '集书阁', description: book.description.substring(0, 100), tags: book.tags })
            existingTitles.add(book.title)
            saveJSON(INDEX_FILE, existingIndex)
            progress.crawled.push(result.id)
            saveJSON(PROGRESS_FILE, progress)

            added++; bookId++
            console.log(`  💾 ${id} - ${detail.title} (${chapters.length} 章)`)
          } catch (e) {
            failed++
            progress.crawled.push(result.id)
            saveJSON(PROGRESS_FILE, progress)
          }
          await bookPage.close()
          await sleep(300)
        }
      } catch (e) {
        console.log(`  ❌ 搜索失败: ${e.message}`)
      }
      await page.close()
      await sleep(500)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n========================================`)
  console.log(`  ✅ 完成！新增: ${added} | 失败: ${failed} | 总计: ${existingIndex.length}`)
  console.log(`========================================\n`)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
