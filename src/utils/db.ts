import type { Book, Chapter, ReadingProgress } from '../types'

const BOOKS_STORE = 'books'
const CHAPTERS_STORE = 'chapters'
const PROGRESS_STORE = 'progress'
const DB_NAME = 'yellow-reader-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const store = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' })
        store.createIndex('sourceId', 'sourceId', { unique: false })
      }
      if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
        const store = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' })
        store.createIndex('bookId', 'bookId', { unique: false })
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readwrite')
    const store = tx.objectStore(BOOKS_STORE)
    book.cached = true
    store.put(book)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readonly')
    const store = tx.objectStore(BOOKS_STORE)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BOOKS_STORE, 'readonly')
    const store = tx.objectStore(BOOKS_STORE)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function removeBook(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BOOKS_STORE, CHAPTERS_STORE], 'readwrite')
    const bookStore = tx.objectStore(BOOKS_STORE)
    const chapterStore = tx.objectStore(CHAPTERS_STORE)
    bookStore.delete(id)
    const chapterIndex = chapterStore.index('bookId')
    const cursorRequest = chapterIndex.openCursor(IDBKeyRange.only(id))
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveChapter(chapter: Chapter): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
    const store = tx.objectStore(CHAPTERS_STORE)
    chapter.cached = true
    store.put(chapter)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const store = tx.objectStore(CHAPTERS_STORE)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getBookChapters(bookId: string): Promise<Chapter[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly')
    const store = tx.objectStore(CHAPTERS_STORE)
    const index = store.index('bookId')
    const request = index.getAll(bookId)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readwrite')
    const store = tx.objectStore(PROGRESS_STORE)
    progress.updatedAt = Date.now()
    store.put(progress)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getProgress(bookId: string): Promise<ReadingProgress | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readonly')
    const store = tx.objectStore(PROGRESS_STORE)
    const request = store.get(bookId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getStorageInfo(): Promise<{ books: number; chapters: number; size: string }> {
  const books = await getAllBooks()
  let chapterCount = 0
  for (const book of books) {
    const chapters = await getBookChapters(book.id)
    chapterCount += chapters.filter(c => c.cached).length
  }
  const totalSize = new Blob([JSON.stringify(await getAllBooks())]).size
  const sizeStr = totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : totalSize > 1024
    ? `${(totalSize / 1024).toFixed(1)} KB`
    : `${totalSize} B`

  return { books: books.length, chapters: chapterCount, size: sizeStr }
}

export async function clearCache(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BOOKS_STORE, CHAPTERS_STORE, PROGRESS_STORE], 'readwrite')
    tx.objectStore(BOOKS_STORE).clear()
    tx.objectStore(CHAPTERS_STORE).clear()
    tx.objectStore(PROGRESS_STORE).clear()
    tx.oncomplete = () => {
      dbPromise = null
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}
