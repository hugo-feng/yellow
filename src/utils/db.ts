import Dexie, { type Table } from 'dexie'
import type { Book, Chapter, ReadingProgress } from '../types'

const db = new Dexie('yellow-reader-db') as Dexie & {
  books: Table<Book, string>
  chapters: Table<Chapter, string>
  progress: Table<ReadingProgress, string>
}

db.version(1).stores({
  books: 'id, sourceId',
  chapters: 'id, bookId',
  progress: 'bookId'
})

export async function saveBook(book: Book): Promise<void> {
  book.cached = true
  await db.books.put(book)
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id)
}

export async function getAllBooks(): Promise<Book[]> {
  return db.books.toArray()
}

export async function removeBook(id: string): Promise<void> {
  await db.transaction('rw', db.books, db.chapters, async () => {
    await db.books.delete(id)
    await db.chapters.where('bookId').equals(id).delete()
  })
}

export async function saveChapter(chapter: Chapter): Promise<void> {
  chapter.cached = true
  await db.chapters.put(chapter)
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id)
}

export async function getBookChapters(bookId: string): Promise<Chapter[]> {
  return db.chapters.where('bookId').equals(bookId).toArray()
}

export async function getChaptersByIdPrefix(bookId: string): Promise<Chapter[]> {
  return db.chapters.where('id').startsWith(`${bookId}-ch-`).toArray()
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  progress.updatedAt = Date.now()
  await db.progress.put(progress)
}

export async function getProgress(bookId: string): Promise<ReadingProgress | undefined> {
  return db.progress.get(bookId)
}

export async function getStorageInfo(): Promise<{ books: number; chapters: number; size: string }> {
  const [books, chapters] = await Promise.all([
    db.books.toArray(),
    db.chapters.toArray()
  ])
  const chapterCount = chapters.filter((c: Chapter) => c.cached).length
  const totalSize = new Blob([JSON.stringify(books)]).size
  const sizeStr = totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : totalSize > 1024
    ? `${(totalSize / 1024).toFixed(1)} KB`
    : `${totalSize} B`
  return { books: books.length, chapters: chapterCount, size: sizeStr }
}

export async function clearCache(): Promise<void> {
  await db.transaction('rw', db.books, db.chapters, db.progress, async () => {
    await db.books.clear()
    await db.chapters.clear()
    await db.progress.clear()
  })
}
