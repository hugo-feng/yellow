import type { Book, BookSource, Chapter, SearchResult } from '../types'

interface SourceDef {
  id: string
  name: string
  homeUrl: string
  searchUrl(path: string): string
  bookUrl(id: string): string
  chapterUrl(bookId: string, chId: string): string
  encoding: 'utf-8' | 'gbk'
  searchParser(html: string, doc: Document): SearchResult[]
  bookParser(html: string, doc: Document): Partial<Book> | Promise<Partial<Book>>
  chapterParser(html: string, doc: Document): { title: string; content: string; prev?: string; next?: string }
}

async function fetchWithEncoding(url: string, encoding: 'utf-8' | 'gbk'): Promise<{ html: string; doc: Document }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  
  let html: string
  if (encoding === 'gbk') {
    const buf = await response.arrayBuffer()
    html = new TextDecoder('gbk').decode(buf)
  } else {
    html = await response.text()
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return { html, doc }
}

// ==================== 笔趣阁类通用解析器 ====================
// 大部分笔趣阁站点结构相同，共用以下解析逻辑

function biquSearchParser(doc: Document): SearchResult[] {
  const results: SearchResult[] = []
  const items = doc.querySelectorAll('.result-list .result-item, .result-item, #search-main li, .novelslist2 li, ul.list li')
  items.forEach((item, i) => {
    const link = item.querySelector('a')
    const img = item.querySelector('img')
    const descEl = item.querySelector('.result-game-item-desc, .result-item-desc, p')
    const infoEls = item.querySelectorAll('.result-game-item-info-tag-item, .result-item-info span')
    
    const href = link?.getAttribute('href') || ''
    const id = href.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '_')
    const title = link?.textContent?.trim() || link?.getAttribute('title') || ''
    const author = infoEls?.[1]?.textContent?.trim() || ''
    const cover = img?.getAttribute('src') || ''
    const desc = descEl?.textContent?.trim() || ''
    
    if (title && href) {
      results.push({ id, title, author, cover, description: desc, sourceId: '', sourceName: '', format: 'html', downloadUrl: href })
    }
  })
  return results
}

function biquBookParser(doc: Document): Partial<Book> {
  const title = doc.querySelector('#info h1, .info h1, h1')?.textContent?.trim() || ''
  const authorEl = doc.querySelector('#info p, .info p')
  const author = authorEl?.textContent?.replace(/作.*?者[：:]/, '').trim() || ''
  const cover = doc.querySelector('#fmimg img, .pic img, .cover img')?.getAttribute('src') || ''
  const intro = doc.querySelector('#intro, .intro, .desc')?.textContent?.trim() || ''
  
  const chapters: Chapter[] = []
  const chLinks = doc.querySelectorAll('#list dd a, #list dt a, .section-box dd a, .chapterlist dd a, dl dd a')
  chLinks.forEach((a, i) => {
    const chHref = a.getAttribute('href') || ''
    const chTitle = a.textContent?.trim() || ''
    if (chHref && chTitle) {
      chapters.push({ id: chHref.replace(/^\//, '').replace(/\//g, '_'), title: chTitle, index: i, url: chHref, cached: false })
    }
  })
  
  return { title, author, cover, description: intro, chapters }
}

function biquChapterParser(doc: Document): { title: string; content: string } {
  const title = doc.querySelector('.bookname h1, .chaptername, h1')?.textContent?.trim() || ''
  const contentEl = doc.querySelector('#content, #chaptercontent, .content, .txt')
  const content = contentEl?.textContent?.trim()
    ?.replace(/\s{2,}/g, '\n')
    ?.replace(/请收藏本站.*?$/gm, '')
    ?.replace(/最快更新.*?$/gm, '')
    ?.replace(/一秒记住.*?$/gm, '')
    ?.replace(/【.*?】/g, '')
    ?.replace(/\(本章完\)/g, '')
    || ''
  return { title, content }
}

// ==================== 20+ 真实书源定义 ====================

const SOURCE_DEFS: SourceDef[] = [
  // --- UTF-8 源 (A类) ---
  {
    id: 'xshuquge', name: '书趣阁', homeUrl: 'https://www.xshuquge.net',
    searchUrl: (q) => `https://www.xshuquge.net/search.html?searchkey=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.xshuquge.net/${id}/`,
    chapterUrl: (bid, cid) => `https://www.xshuquge.net/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biquqi', name: '笔趣奇', homeUrl: 'https://www.biquqi.com',
    searchUrl: (q) => `/api/proxy?url=${encodeURIComponent(`https://www.biquqi.com/search?keyword=${encodeURIComponent(q)}`)}`,
    bookUrl: (id) => `/api/proxy?url=${encodeURIComponent(`https://www.biquqi.com/${id}/`)}`,
    chapterUrl: (bid, cid) => `/api/proxy?url=${encodeURIComponent(`https://www.biquqi.com/${bid}/${cid}.html`)}`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'bqukan', name: '笔趣看', homeUrl: 'https://www.bqukan.com',
    searchUrl: (q) => `https://www.bqukan.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.bqukan.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.bqukan.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqugua', name: '笔趣瓜', homeUrl: 'https://www.biqugua.com',
    searchUrl: (q) => `https://www.biqugua.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqugua.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqugua.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqugu', name: '笔趣谷', homeUrl: 'https://www.biqugu.cc',
    searchUrl: (q) => `https://www.biqugu.cc/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqugu.cc/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqugu.cc/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'xbiqugu', name: '香书小说', homeUrl: 'https://www.xbiqugu.com',
    searchUrl: (q) => `https://www.xbiqugu.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.xbiqugu.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.xbiqugu.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biquge5', name: '笔趣阁5', homeUrl: 'https://www.biquge5.com',
    searchUrl: (q) => `https://www.biquge5.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biquge5.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biquge5.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biquhi', name: '笔趣阁hi', homeUrl: 'https://www.biquhi.com',
    searchUrl: (q) => `https://www.biquhi.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biquhi.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biquhi.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biquj', name: '笔趣阁j', homeUrl: 'https://www.biquj.com',
    searchUrl: (q) => `https://www.biquj.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biquj.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biquj.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biquxia', name: '笔趣下', homeUrl: 'https://www.biquxia.com',
    searchUrl: (q) => `https://www.biquxia.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biquxia.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biquxia.com/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqule', name: '笔趣乐', homeUrl: 'https://www.biqule.net',
    searchUrl: (q) => `https://www.biqule.net/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqule.net/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqule.net/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'mibaoge', name: '妙笔阁', homeUrl: 'https://www.xinmiaobige.net',
    searchUrl: (q) => `https://www.xinmiaobige.net/search.html?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.xinmiaobige.net/${id}/`,
    chapterUrl: (bid, cid) => `https://www.xinmiaobige.net/${bid}/${cid}.html`,
    encoding: 'utf-8',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  // --- GBK 源 (B类) ---
  {
    id: 'biquwo', name: '趣笔阁', homeUrl: 'https://www.biquwo.com',
    searchUrl: (q) => `https://www.biquwo.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biquwo.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biquwo.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqudu', name: '笔趣阁du', homeUrl: 'https://www.biqudu.com',
    searchUrl: (q) => `https://www.biqudu.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqudu.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqudu.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'qula', name: '趣阅阁', homeUrl: 'https://www.qu-la.com',
    searchUrl: (q) => `https://www.qu-la.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.qu-la.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.qu-la.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'ddyueshu', name: '顶点小说', homeUrl: 'https://www.ddyueshu.com',
    searchUrl: (q) => `https://www.ddyueshu.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.ddyueshu.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.ddyueshu.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqugeu', name: '笔趣阁eu', homeUrl: 'https://www.biqugeu.net',
    searchUrl: (q) => `https://www.biqugeu.net/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqugeu.net/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqugeu.net/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqukan2', name: '笔趣阁kan', homeUrl: 'https://www.biqukan.com',
    searchUrl: (q) => `https://www.biqukan.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqukan.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqukan.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biduo', name: '笔趣阁duo', homeUrl: 'https://www.biduo.cc',
    searchUrl: (q) => `https://www.biduo.cc/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biduo.cc/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biduo.cc/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  {
    id: 'biqucp', name: '笔趣阁cp', homeUrl: 'https://www.biqucp.com',
    searchUrl: (q) => `https://www.biqucp.com/search?keyword=${encodeURIComponent(q)}`,
    bookUrl: (id) => `https://www.biqucp.com/${id}/`,
    chapterUrl: (bid, cid) => `https://www.biqucp.com/${bid}/${cid}.html`,
    encoding: 'gbk',
    searchParser: (_, doc) => biquSearchParser(doc),
    bookParser: (_, doc) => biquBookParser(doc),
    chapterParser: (_, doc) => biquChapterParser(doc)
  },
  // --- 集书阁 (专属解析) ---
  {
    id: 'jisge', name: '集书阁', homeUrl: 'https://26b.jisge.com',
    searchUrl: (q) => `https://26b.jisge.com/list-${encodeURI(q)}.html`,
    bookUrl: (id) => {
      if (id.includes('contentlist_')) return `https://26b.jisge.com/${id}.html`
      return `https://26b.jisge.com/content_${id}.html`
    },
    chapterUrl: (bid, cid) => {
      return `https://26b.jisge.com/content_${bid}_${cid}.html`
    },
    encoding: 'utf-8' as const,
    searchParser: (_html: string, doc: Document): SearchResult[] => {
      const results: SearchResult[] = []
      const items = doc.querySelectorAll('ul.ucontent li a')
      items.forEach((a) => {
        const titleEl = a.querySelector('.title')
        const descEl = a.querySelector('.description')
        const href = a.getAttribute('href') || ''
        const id = href.replace(/^\//, '').replace(/\.html$/, '')
        const title = titleEl?.textContent?.trim() || ''
        if (title && href) {
          results.push({
            id, title,
            author: '',
            cover: '',
            description: descEl?.textContent?.trim() || '',
            sourceId: 'jisge', sourceName: '集书阁',
            format: 'html', downloadUrl: href
          })
        }
      })
      return results
    },
    bookParser: async (_html: string, doc: Document): Promise<Partial<Book>> => {
      const titleEl = doc.querySelector('.content-title div:last-child, .book-title')
      const title = titleEl?.textContent?.trim() || ''
      const chapters: Chapter[] = []
      
      // Case 1: This is a content page with #bookcontent (short story)
      if (doc.querySelector('#bookcontent p')) {
        chapters.push({ id: 'ch1', title: title || '正文', index: 0, url: '', cached: false })
        return { title, author: '', cover: '', description: '', chapters }
      }
      
      // Case 2: Check for chapter list in current page
      const chLinks = doc.querySelectorAll('ul.ucontent li a')
      if (chLinks.length > 0) {
        chLinks.forEach((a, i) => {
          const chHref = a.getAttribute('href') || ''
          const chTitle = a.querySelector('.title')?.textContent?.trim() || a.textContent?.trim() || ''
          if (chHref && chTitle) {
            chapters.push({ id: chHref.replace(/^\//, '').replace(/\.html$/, ''), title: chTitle, index: i, url: chHref, cached: false })
          }
        })
        if (chapters.length > 0) return { title, author: '', cover: '', description: '', chapters }
      }
      
      // No chapters found, treat as single page
      chapters.push({ id: 'ch1', title: title || '正文', index: 0, url: '', cached: false })
      return { title, author: '', cover: '', description: '', chapters }
    },
    chapterParser: (_html: string, doc: Document): { title: string; content: string } => {
      const title = doc.querySelector('.content-title div:last-child')?.textContent?.trim() || ''
      const paragraphs = doc.querySelectorAll('#bookcontent p')
      const lines: string[] = []
      paragraphs.forEach(p => {
        let text = p.textContent || ''
        // Clean interference text
        text = text.replace(/来源[：:]\s*\S+/g, '')
          .replace(/jishuge\S*/gi, '')
          .replace(/集书阁\S*/g, '')
          .replace(/请收藏.*?$/gm, '')
          .replace(/https?:\/\/\S+/g, '')
          .trim()
        if (text.length > 2) lines.push(text)
      })
      return { title, content: lines.join('\n\n') }
    }
  }
]

// 构建 BookSource 对象
function buildSource(def: SourceDef): BookSource {
  return {
    id: def.id,
    name: def.name,
    baseUrl: def.homeUrl,
    enabled: true,
    async searchBooks(query: string): Promise<SearchResult[]> {
      const url = def.searchUrl(query)
      const { doc } = await fetchWithEncoding(url, def.encoding)
      const results = def.searchParser('', doc)
      return results.map(r => ({
        ...r,
        sourceId: def.id,
        sourceName: def.name
      }))
    },
    async getBookDetail(bookId: string): Promise<Book> {
      const url = def.bookUrl(bookId)
      const { doc } = await fetchWithEncoding(url, def.encoding)
      const detail = await def.bookParser('', doc)
      return {
        id: bookId,
        title: detail.title || '未知书名',
        author: detail.author || '未知作者',
        cover: detail.cover || '',
        description: detail.description || '暂无简介',
        sourceId: def.id,
        sourceName: def.name,
        format: 'html',
        downloadUrl: url,
        chapters: (detail.chapters || []).map((ch: Chapter) => ({
          ...ch,
          id: ch.id || `${bookId}_${ch.index}`,
          cached: false
        })),
        cached: false
      }
    },
    async getChapterContent(bookId: string, chapterId: string): Promise<string> {
      const def2 = SOURCE_DEFS.find(s => s.id === def.id)!
      const url = def2.chapterUrl(bookId, chapterId)
      const { doc } = await fetchWithEncoding(url, def.encoding)
      const result = def.chapterParser('', doc)
      return `## ${result.title}\n\n${result.content}`
    }
  }
}

// 所有书源
export const allSources: Record<string, BookSource> = {}
SOURCE_DEFS.forEach(def => {
  allSources[def.id] = buildSource(def)
})

// 跨源搜索
export async function searchAcrossSources(
  query: string,
  sourceIds?: string[]
): Promise<SearchResult[]> {
  const sources = sourceIds
    ? sourceIds.map(id => allSources[id]).filter(Boolean)
    : Object.values(allSources).filter(s => s.enabled)

  // 限制并发数
  const batchSize = 5
  const allResults: SearchResult[] = []
  
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(async source => {
        try {
          return await source.searchBooks(query)
        } catch {
          return [] as SearchResult[]
        }
      })
    )
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value)
      }
    }
  }

  return allResults
}

// 获取书源名称
export function getSourceName(sourceId: string): string {
  return allSources[sourceId]?.name || '未知书源'
}

// 获取书籍内容（含章节）
export async function getBookContent(bookId: string, sourceId: string): Promise<Book> {
  const source = allSources[sourceId]
  if (!source) throw new Error('书源不存在')
  return source.getBookDetail(bookId)
}

// 获取章节内容
export async function getChapterContent(bookId: string, chapterId: string, sourceId: string): Promise<string> {
  const source = allSources[sourceId]
  if (!source) throw new Error('书源不存在')
  return source.getChapterContent(bookId, chapterId)
}

// 获取书源数量
export function getSourceCount(): number {
  return Object.keys(allSources).length
}
