import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')

function loadJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}

function main() {
  console.log('\n========================================')
  console.log('  清理无章节内容的书籍')
  console.log('========================================\n')

  const index = loadJSON(INDEX_FILE, [])
  const initialCount = index.length
  const toRemove = []

  for (const entry of index) {
    const bookFile = path.join(BOOKS_DIR, `${entry.id}.json`)
    if (!fs.existsSync(bookFile)) {
      console.log(`  [缺失文件] ${entry.id} - ${entry.title}`)
      toRemove.push(entry.id)
      continue
    }

    const bookData = loadJSON(bookFile, null)
    if (!bookData) {
      console.log(`  [JSON解析失败] ${entry.id} - ${entry.title}`)
      toRemove.push(entry.id)
      continue
    }

    const chapters = bookData.chapters || []
    if (chapters.length === 0) {
      console.log(`  [无章节] ${entry.id} - ${entry.title}`)
      toRemove.push(entry.id)
      continue
    }

    const hasContent = chapters.some(ch => ch.content && ch.content.trim().length > 0)
    if (!hasContent) {
      console.log(`  [章节无内容] ${entry.id} - ${entry.title} (${chapters.length} 章全为空)`)
      toRemove.push(entry.id)
    }
  }

  if (toRemove.length === 0) {
    console.log('  所有书籍都有章节内容，无需清理。\n')
    return
  }

  console.log(`\n  共 ${toRemove.length} 本书需要清理\n`)

  for (const id of toRemove) {
    const bookFile = path.join(BOOKS_DIR, `${id}.json`)
    try {
      if (fs.existsSync(bookFile)) {
        fs.unlinkSync(bookFile)
        console.log(`  已删除: ${id}.json`)
      }
    } catch (e) {
      console.log(`  删除失败: ${id}.json - ${e.message}`)
    }
  }

  const newIndex = index.filter(entry => !toRemove.includes(entry.id))
  fs.writeFileSync(INDEX_FILE, JSON.stringify(newIndex, null, 2))

  console.log(`\n========================================`)
  console.log(`  完成！清理前: ${initialCount} | 清理: ${toRemove.length} | 剩余: ${newIndex.length}`)
  console.log(`========================================\n`)
}

main()
