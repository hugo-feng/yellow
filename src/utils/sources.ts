import type { Book, BookSource, Chapter, SearchResult } from '../types'

const GUTENDEX_API = 'https://gutendex.com'

async function gutendexSearch(query: string): Promise<SearchResult[]> {
  const response = await fetch(`${GUTENDEX_API}/books?search=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('搜索失败')
  const data = await response.json()
  return data.results.map((book: any) => ({
    id: String(book.id),
    title: book.title,
    author: book.authors?.map((a: any) => a.name).join(', ') || '未知作者',
    cover: book.formats['image/jpeg'] || book.formats['image/png'] || '',
    description: book.subjects?.slice(0, 3).join('、') || '无描述',
    sourceId: 'gutendex',
    sourceName: 'Project Gutenberg',
    format: 'text',
    downloadUrl: book.formats['text/plain; charset=utf-8'] || book.formats['text/plain'] || book.formats['text/html'] || ''
  }))
}

async function gutendexGetBookDetail(bookId: string): Promise<Book> {
  const response = await fetch(`${GUTENDEX_API}/books/${bookId}`)
  if (!response.ok) throw new Error('获取书籍详情失败')
  const data = await response.json()
  const textUrl = data.formats['text/plain; charset=utf-8']
    || data.formats['text/plain']
    || data.formats['text/html']
    || ''

  return {
    id: String(data.id),
    title: data.title,
    author: data.authors?.map((a: any) => a.name).join(', ') || '未知作者',
    cover: data.formats['image/jpeg'] || data.formats['image/png'] || '',
    description: data.subjects?.slice(0, 5).join('、') || '无描述',
    sourceId: 'gutendex',
    sourceName: 'Project Gutenberg',
    format: 'text',
    downloadUrl: textUrl,
    chapters: [],
    cached: false
  }
}

async function gutendexGetChapterContent(bookId: string): Promise<string> {
  const book = await gutendexGetBookDetail(bookId)
  if (!book.downloadUrl) return '无可用内容'

  const response = await fetch(book.downloadUrl)
  if (!response.ok) throw new Error('获取章节内容失败')
  return await response.text()
}

export const gutendexSource: BookSource = {
  id: 'gutendex',
  name: 'Project Gutenberg',
  baseUrl: GUTENDEX_API,
  enabled: true,
  searchBooks: gutendexSearch,
  getBookDetail: gutendexGetBookDetail,
  getChapterContent: gutendexGetChapterContent as any
}

const OPENLIBRARY_API = 'https://openlibrary.org'

async function openLibrarySearch(query: string): Promise<SearchResult[]> {
  const response = await fetch(
    `${OPENLIBRARY_API}/search.json?q=${encodeURIComponent(query)}&limit=20`
  )
  if (!response.ok) throw new Error('搜索失败')
  const data = await response.json()
  return (data.docs || []).map((doc: any) => ({
    id: doc.key.replace('/works/', ''),
    title: doc.title,
    author: doc.author_name?.join(', ') || '未知作者',
    cover: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : '',
    description: doc.subject?.slice(0, 3).join('、') || '无描述',
    sourceId: 'openlibrary',
    sourceName: 'Open Library',
    format: 'text',
    downloadUrl: doc.key || ''
  }))
}

async function openLibraryGetBookDetail(workId: string): Promise<Book> {
  const response = await fetch(`${OPENLIBRARY_API}/works/${workId}.json`)
  if (!response.ok) throw new Error('获取书籍详情失败')
  const data = await response.json()
  return {
    id: workId,
    title: data.title,
    author: data.authors?.map((a: any) => a.author?.key)?.join(', ') || '未知作者',
    cover: data.covers
      ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
      : '',
    description: data.description?.value || data.description || '无描述',
    sourceId: 'openlibrary',
    sourceName: 'Open Library',
    format: 'text',
    downloadUrl: '',
    chapters: [],
    cached: false
  }
}

async function openLibraryGetChapterContent(): Promise<string> {
  return 'Open Library 暂不支持直接阅读，请切换书源'
}

export const openLibrarySource: BookSource = {
  id: 'openlibrary',
  name: 'Open Library',
  baseUrl: OPENLIBRARY_API,
  enabled: true,
  searchBooks: openLibrarySearch,
  getBookDetail: openLibraryGetBookDetail,
  getChapterContent: openLibraryGetChapterContent as any
}

export const allSources: Record<string, BookSource> = {
  gutendex: gutendexSource,
  openlibrary: openLibrarySource
}

export async function searchAcrossSources(
  query: string,
  sourceIds?: string[]
): Promise<SearchResult[]> {
  const sources = sourceIds
    ? sourceIds.map(id => allSources[id]).filter(Boolean)
    : Object.values(allSources).filter(s => s.enabled)

  const results = await Promise.allSettled(
    sources.map(source =>
      source.searchBooks(query).catch(() => [] as SearchResult[])
    )
  )

  const allResults: SearchResult[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    }
  })

  return allResults
}

export async function getBookContent(bookId: string, sourceId: string): Promise<Book> {
  const source = allSources[sourceId]
  if (!source) throw new Error('书源不存在')

  const book = await source.getBookDetail(bookId)

  if (sourceId === 'gutendex' && book.downloadUrl) {
    const content = await source.getChapterContent(bookId)
    book.chapters = [{ id: `${bookId}-ch1`, title: '正文', index: 0, url: book.downloadUrl, content, cached: false }]
  } else {
    book.chapters = [{ id: `${bookId}-ch1`, title: '正文', index: 0, url: '', content: '', cached: false }]
  }

  return book
}

export function getSourceName(sourceId: string): string {
  return allSources[sourceId]?.name || '未知书源'
}
