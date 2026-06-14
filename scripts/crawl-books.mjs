/**
 * 正版书籍爬虫 v6 - 极速版
 * 组合搜索(书名+作者) + 只查前20候选 + 快速跳过
 */

import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const PROGRESS_FILE = path.join(__dirname, '..', '.crawl-progress.json')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MAX_CHAPTERS = 30
const MAX_CANDIDATES = 20
const REQ_DELAY = 200
const CH_DELAY = 150

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchText(url, timeout = 8000) {
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
    .replace(/【.*?】/g, '').replace(/\(本章完\)/g, '')
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
  const map = { '修仙': '修仙', '重生': '重生', '穿越': '穿越', '玄幻': '玄幻', '仙侠': '仙侠', '历史': '历史', '悬疑': '悬疑', '科幻': '科幻', '言情': '言情', '武侠': '武侠', '都市': '都市', '末世': '末世', '灵异': '灵异', '军事': '军事', '奇幻': '奇幻' }
  for (const [k, v] of Object.entries(map)) {
    if (text.includes(k) && !tags.includes(v)) tags.push(v)
  }
  return tags.length > 0 ? tags.slice(0, 4) : ['其他']
}

// ==================== 正版书单 ====================
const BOOK_LIST = [
  { title: '斗罗大陆', author: '唐家三少' },
  { title: '斗罗大陆II绝世唐门', author: '唐家三少' },
  { title: '斗罗大陆III龙王传说', author: '唐家三少' },
  { title: '斗罗大陆IV终极斗罗', author: '唐家三少' },
  { title: '天珠变', author: '唐家三少' },
  { title: '酒神', author: '唐家三少' },
  { title: '琴帝', author: '唐家三少' },
  { title: '神印王座', author: '唐家三少' },
  { title: '惟我独仙', author: '唐家三少' },
  { title: '空速星痕', author: '唐家三少' },
  { title: '狂神', author: '唐家三少' },
  { title: '冰火魔厨', author: '唐家三少' },
  { title: '盘龙', author: '我吃西红柿' },
  { title: '星辰变', author: '我吃西红柿' },
  { title: '吞噬星空', author: '我吃西红柿' },
  { title: '莽荒纪', author: '我吃西红柿' },
  { title: '雪鹰领主', author: '我吃西红柿' },
  { title: '寸芒', author: '我吃西红柿' },
  { title: '沧元图', author: '我吃西红柿' },
  { title: '九鼎记', author: '我吃西红柿' },
  { title: '飞剑问道', author: '我吃西红柿' },
  { title: '斗破苍穹', author: '天蚕土豆' },
  { title: '武动乾坤', author: '天蚕土豆' },
  { title: '大主宰', author: '天蚕土豆' },
  { title: '元尊', author: '天蚕土豆' },
  { title: '万相之王', author: '天蚕土豆' },
  { title: '遮天', author: '辰东' },
  { title: '完美世界', author: '辰东' },
  { title: '圣墟', author: '辰东' },
  { title: '神墓', author: '辰东' },
  { title: '长生界', author: '辰东' },
  { title: '深空彼岸', author: '辰东' },
  { title: '凡人修仙传', author: '忘语' },
  { title: '凡人修仙之仙界篇', author: '忘语' },
  { title: '玄界之门', author: '忘语' },
  { title: '仙逆', author: '耳根' },
  { title: '一念永恒', author: '耳根' },
  { title: '我欲封天', author: '耳根' },
  { title: '三寸人间', author: '耳根' },
  { title: '庆余年', author: '猫腻' },
  { title: '将夜', author: '猫腻' },
  { title: '间客', author: '猫腻' },
  { title: '大道朝天', author: '猫腻' },
  { title: '择天记', author: '猫腻' },
  { title: '雪中悍刀行', author: '烽火戏诸侯' },
  { title: '剑来', author: '烽火戏诸侯' },
  { title: '陈二狗的妖孽人生', author: '烽火戏诸侯' },
  { title: '诛仙', author: '萧鼎' },
  { title: '盗墓笔记', author: '南派三叔' },
  { title: '鬼吹灯', author: '天下霸唱' },
  { title: '全职高手', author: '蝴蝶蓝' },
  { title: '赘婿', author: '愤怒的香蕉' },
  { title: '诡秘之主', author: '爱潜水的乌贼' },
  { title: '宿命之环', author: '爱潜水的乌贼' },
  { title: '奥术神座', author: '爱潜水的乌贼' },
  { title: '大奉打更人', author: '卖报小郎君' },
  { title: '第一序列', author: '会说话的肘子' },
  { title: '夜的命名术', author: '会说话的肘子' },
  { title: '万族之劫', author: '老鹰吃小鸡' },
  { title: '全球高武', author: '老鹰吃小鸡' },
  { title: '深海余烬', author: '远瞳' },
  { title: '异常生物见闻录', author: '远瞳' },
  { title: '超神机械师', author: '齐佩甲' },
  { title: '绝世武神', author: '净无痕' },
  { title: '太古神王', author: '净无痕' },
  { title: '武炼巅峰', author: '莫默' },
  { title: '傲世九重天', author: '风凌天下' },
  { title: '天才相师', author: '打眼' },
  { title: '黄金瞳', author: '打眼' },
  { title: '极品家丁', author: '禹岩' },
  { title: '回到明朝当王爷', author: '月关' },
  { title: '步步生莲', author: '月关' },
  { title: '紫川', author: '老猪' },
  { title: '帝霸', author: '厌笔萧生' },
  { title: '牧神记', author: '宅猪' },
  { title: '临渊行', author: '宅猪' },
  { title: '佛本是道', author: '梦入神机' },
  { title: '阳神', author: '梦入神机' },
  { title: '道诡异仙', author: '狐尾的笔' },
  { title: '天道图书馆', author: '横扫天涯' },
  { title: '我有一座恐怖屋', author: '我会修空调' },
  { title: '修真聊天群', author: '圣骑士的传说' },
  { title: '亏成首富从游戏开始', author: '青衫取醉' },
  { title: '大国重工', author: '齐橙' },
  { title: '唐砖', author: '孑与2' },
  { title: '校花的贴身高手', author: '鱼人二代' },
  { title: '琥珀之剑', author: '绯炎' },
  { title: '我师兄实在太稳健了', author: '言归正传' },
  { title: '万古第一神', author: '风青阳' },
  { title: '一剑独尊', author: '青鸾峰上' },
  { title: '我有一剑', author: '青鸾峰上' },
  { title: '尘缘', author: '烟雨江南' },
  { title: '永夜君王', author: '烟雨江南' },
  { title: '修真四万年', author: '卧牛真人' },
  { title: '天行健', author: '燕垒生' },
  { title: '官道无疆', author: '三戒大师' },
  { title: '知否知否应是绿肥红瘦', author: '关心则乱' },
  { title: '斗罗大陆V重生唐三', author: '唐家三少' },
  { title: '间客', author: '猫腻' },
  { title: '搜神记', author: '树下野狐' },
  { title: '蛮荒记', author: '树下野狐' },
  { title: '道君', author: '跃千愁' },
  { title: '枭臣', author: '更俗' },
  { title: '一世独尊', author: '阿彩' },
  { title: '昆仑', author: '凤歌' },
  { title: '英雄志', author: '孙晓' },
]

// ==================== 书源 ====================

const SOURCES = [
  {
    id: 'biquqi', name: '笔趣奇',
    searchUrl: (q) => `https://www.biquqi.com/search.php?q=${encodeURIComponent(q)}`,
    parseResults(html) {
      const doc = parseDoc(html)
      const r = []
      doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || ''
        const title = a.textContent?.trim() || ''
        if (href.match(/\/book\/\d+\/\d+\/$/) && title.length > 1 && title.length < 40) {
          r.push({ id: href.replace(/^\//, '').replace(/\/$/, ''), title })
        }
      })
      return r
    },
    bookUrl: id => `https://www.biquqi.com/${id}/`,
    parseBook(doc) {
      const title = doc.querySelector('h1')?.textContent?.trim() || ''
      let author = ''
      doc.querySelectorAll('p, span, div').forEach(el => {
        const m = (el.textContent || '').match(/作\s*者[：:]\s*([^\s,，\n]+)/)
        if (m && !author) author = m[1].trim()
      })
      const intro = doc.querySelector('.intro, .desc, #intro')?.textContent?.trim() || ''
      const chapters = []
      doc.querySelectorAll('a').forEach((a, i) => {
        const href = a.getAttribute('href') || ''
        const chTitle = a.textContent?.trim() || ''
        if (href.match(/\/book\/\d+\/\d+\/\d+\.html/) && chTitle.length > 1 && chTitle.length < 50) {
          chapters.push({ id: href.split('/').pop()?.replace('.html', '') || `ch${i}`, title: chTitle, index: chapters.length, url: href })
        }
      })
      return { title, author, description: intro, chapters }
    },
    chapterUrl: (bid, cid) => `https://www.biquqi.com/${bid}/${cid}.html`,
    parseChapter(doc) {
      return cleanText((doc.querySelector('article') || doc.querySelector('#content'))?.textContent || '')
    }
  },
  {
    id: 'bqukan', name: '笔趣看',
    searchUrl: (q) => `https://www.bqukan.com/search?keyword=${encodeURIComponent(q)}`,
    parseResults(html) {
      const doc = parseDoc(html)
      const r = []
      doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || ''
        const title = a.textContent?.trim() || ''
        if (href.match(/\/book\/[a-z0-9]+\/?$/) && title.length > 1 && title.length < 40) {
          r.push({ id: href.replace(/^\//, '').replace(/\/$/, ''), title })
        }
      })
      return r
    },
    bookUrl: id => `https://www.bqukan.com/${id}/`,
    parseBook(doc) {
      const title = doc.querySelector('h1')?.textContent?.trim() || ''
      let author = ''
      doc.querySelectorAll('p, span, div').forEach(el => {
        const m = (el.textContent || '').match(/作\s*者[：:]\s*([^\s,，\n]+)/)
        if (m && !author) author = m[1].trim()
      })
      const intro = doc.querySelector('.intro, .desc, #intro')?.textContent?.trim() || ''
      const chapters = []
      const seen = new Set()
      doc.querySelectorAll('a').forEach((a, i) => {
        const href = a.getAttribute('href') || ''
        const chTitle = a.textContent?.trim() || ''
        if (href.match(/\/book\/[a-z0-9]+\/[a-z0-9]+/) && chTitle.length > 1 && chTitle.length < 50 && chTitle !== '开始阅读') {
          const chId = href.split('/').pop() || `ch${i}`
          if (!seen.has(chId)) { seen.add(chId); chapters.push({ id: chId, title: chTitle, index: chapters.length, url: href }) }
        }
      })
      return { title, author, description: intro, chapters }
    },
    chapterUrl: (bid, cid) => `https://www.bqukan.com/${bid}/${cid}`,
    parseChapter(doc) {
      return cleanText((doc.querySelector('article') || doc.querySelector('#chaptercontent') || doc.querySelector('#content'))?.textContent || '')
    }
  },
  {
    id: 'biqule', name: '笔趣乐',
    searchUrl: (q) => `https://www.biqule.net/search.html?searchkey=${encodeURIComponent(q)}`,
    parseResults(html) {
      const doc = parseDoc(html)
      const r = []
      doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || ''
        const title = a.textContent?.trim() || ''
        if (href.match(/^\/\d+\/\d+\/$/) && title.length > 1 && title.length < 40) {
          r.push({ id: href.replace(/^\//, '').replace(/\/$/, ''), title })
        }
      })
      return r
    },
    bookUrl: id => `https://www.biqule.net/${id}/`,
    parseBook(doc) {
      const title = doc.querySelector('h1')?.textContent?.trim() || ''
      let author = ''
      doc.querySelectorAll('p, span, div').forEach(el => {
        const m = (el.textContent || '').match(/作\s*者[：:]\s*([^\s,，\n]+)/)
        if (m && !author) author = m[1].trim()
      })
      const intro = doc.querySelector('.intro, .desc, #intro')?.textContent?.trim() || ''
      const chapters = []
      doc.querySelectorAll('a').forEach((a, i) => {
        const href = a.getAttribute('href') || ''
        const chTitle = a.textContent?.trim() || ''
        if (href.match(/^\/\d+\/\d+\/\d+\.html/) && chTitle.length > 1 && chTitle.length < 50) {
          chapters.push({ id: href.split('/').pop()?.replace('.html', '') || `ch${i}`, title: chTitle, index: chapters.length, url: href })
        }
      })
      return { title, author, description: intro, chapters }
    },
    chapterUrl: (bid, cid) => `https://www.biqule.net/${bid}/${cid}.html`,
    parseChapter(doc) {
      return cleanText((doc.querySelector('article') || doc.querySelector('#content'))?.textContent || '')
    }
  },
]

// ==================== 核心 ====================

function verifyBook(foundTitle, foundAuthor, targetTitle, targetAuthor) {
  const ft = foundTitle.replace(/[\s\u3000]/g, '').toLowerCase()
  const tt = targetTitle.replace(/[\s\u3000]/g, '').toLowerCase()
  const fa = (foundAuthor || '').replace(/[\s\u3000]/g, '').toLowerCase()
  const ta = targetAuthor.replace(/[\s\u3000]/g, '').toLowerCase()
  if (ft !== tt) return { pass: false, reason: `书名: "${foundTitle}" ≠ "${targetTitle}"` }
  if (fa && ta && !fa.includes(ta) && !ta.includes(fa)) return { pass: false, reason: `作者: "${foundAuthor}" ≠ "${targetAuthor}"` }
  return { pass: true }
}

async function searchSource(source, keyword) {
  try {
    const html = await fetchText(source.searchUrl(keyword), 8000)
    return source.parseResults(html)
  } catch { return [] }
}

async function main() {
  console.log(`\n========================================`)
  console.log(`  正版书籍爬虫 v6 - 极速版`)
  console.log(`  书单: ${BOOK_LIST.length} 本 | 源: ${SOURCES.length} 个`)
  console.log(`========================================\n`)

  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR, { recursive: true })

  const progress = loadJSON(PROGRESS_FILE, { completed: [], failed: [] })
  const existingIndex = loadJSON(INDEX_FILE, [])
  const existingTitles = new Set(existingIndex.map(b => b.title))

  let bookId = getNextBookId()
  let added = 0, skipped = 0, failed = 0

  for (let i = 0; i < BOOK_LIST.length; i++) {
    const target = BOOK_LIST[i]

    if (existingTitles.has(target.title)) { skipped++; continue }

    console.log(`[${i + 1}/${BOOK_LIST.length}] 🔍 ${target.title} (${target.author})`)

    // 组合搜索：书名+作者 提高精确度
    const searchQuery = `${target.title} ${target.author}`

    // 并行搜索所有源
    const allResults = await Promise.all(
      SOURCES.map(async source => {
        const results = await searchSource(source, searchQuery)
        // 如果组合搜索没结果，单独搜书名
        if (results.length === 0) {
          const fallback = await searchSource(source, target.title)
          return fallback.map(r => ({ ...r, source }))
        }
        return results.map(r => ({ ...r, source }))
      })
    )

    const candidates = allResults.flat().slice(0, MAX_CANDIDATES)
    console.log(`  候选: ${candidates.length} 个`)

    if (candidates.length === 0) { console.log('  ❌ 无结果'); failed++; continue }

    let found = false
    for (const cand of candidates) {
      const key = `${cand.source.id}:${cand.id}`
      if (progress.completed.includes(key) || progress.failed.includes(key)) continue

      try {
        const html = await fetchText(cand.source.bookUrl(cand.id), 8000)
        const doc = parseDoc(html)
        const detail = cand.source.parseBook(doc)

        const check = verifyBook(detail.title, detail.author, target.title, target.author)
        if (!check.pass) { progress.failed.push(key); continue }

        console.log(`  ✅ [${cand.source.name}] 验证通过 ${detail.chapters.length} 章`)

        // 获取章节
        const chapters = []
        for (const ch of detail.chapters.slice(0, MAX_CHAPTERS)) {
          try {
            const chHtml = await fetchText(cand.source.chapterUrl(cand.id, ch.id), 8000)
            const chDoc = parseDoc(chHtml)
            const content = cand.source.parseChapter(chDoc)
            if (content && content.length > 20) {
              chapters.push({ id: ch.id, title: ch.title, index: chapters.length, url: ch.url, content })
            }
          } catch {}
          await sleep(CH_DELAY)
        }

        if (chapters.length === 0) { console.log('  ❌ 章节获取失败'); failed++; break }

        const id = `book_${bookId}`
        const book = {
          id, title: detail.title, author: detail.author || target.author,
          description: detail.description?.substring(0, 200) || `${target.title} - ${target.author}`,
          sourceId: cand.source.id, sourceName: cand.source.name,
          chapters, tags: guessTags(target.title + ' ' + (detail.description || ''))
        }

        fs.writeFileSync(path.join(BOOKS_DIR, `${id}.json`), JSON.stringify(book, null, 2))
        existingIndex.push({ id, title: book.title, author: book.author, sourceId: book.sourceId, sourceName: book.sourceName, description: book.description.substring(0, 100), tags: book.tags })
        existingTitles.add(book.title)
        saveJSON(INDEX_FILE, existingIndex)
        progress.completed.push(key)
        saveJSON(PROGRESS_FILE, progress)

        added++; bookId++
        console.log(`  💾 ${id} (${chapters.length} 章)`)
        found = true
        await sleep(REQ_DELAY)
        break
      } catch {}
    }

    if (!found) { console.log('  ❌ 未通过验证'); failed++ }
    await sleep(REQ_DELAY)
  }

  console.log(`\n========================================`)
  console.log(`  ✅ 新增: ${added} | 跳过: ${skipped} | 失败: ${failed} | 总计: ${existingIndex.length}`)
  console.log(`========================================\n`)

  saveJSON(INDEX_FILE, existingIndex)
  saveJSON(PROGRESS_FILE, progress)
}

main().catch(e => { console.error('致命错误:', e); process.exit(1) })
