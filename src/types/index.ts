export interface Book {
  id: string
  title: string
  author: string
  cover: string
  description: string
  sourceId: string
  sourceName: string
  format: string
  downloadUrl: string
  chapters: Chapter[]
  cached: boolean
}

export interface Chapter {
  id: string
  title: string
  index: number
  url: string
  content?: string
  cached: boolean
}

export interface BookSource {
  id: string
  name: string
  baseUrl: string
  enabled: boolean
  searchBooks(query: string): Promise<SearchResult[]>
  getBookDetail(id: string): Promise<Book>
  getChapterContent(bookId: string, chapterId?: string): Promise<string>
}

export interface SearchResult {
  id: string
  title: string
  author: string
  cover: string
  description: string
  sourceId: string
  sourceName: string
  format: string
  downloadUrl: string
}

export interface ReadingProgress {
  bookId: string
  chapterIndex: number
  scrollPosition: number
  updatedAt: number
}

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: 'light' | 'dark' | 'sepia'
  fontFamily: string
  maxWidth: number
}

export type TabKey = 'bookshelf' | 'search' | 'settings'
