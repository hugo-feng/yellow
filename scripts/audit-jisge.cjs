const fs = require('fs')
const path = require('path')

const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
const jisge = idx.filter(b => b.sourceId === 'jisge')

let totalBooks = 0, shortBooks = 0, emptyBooks = 0, noTagBooks = 0, badOrderBooks = 0, sourceInContent = 0, quoteIssues = 0
const issues = []

for (const b of jisge) {
  totalBooks++
  try {
    const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, b.id + '.json'), 'utf8'))
    const chs = book.chapters || []
    const bookIssues = []

    // Check chapter count
    if (chs.length === 0) { emptyBooks++; bookIssues.push('no chapters') }
    else if (chs.length < 3) { shortBooks++; bookIssues.push(`only ${chs.length} chapters`) }

    // Check tags
    if (!b.tags || b.tags.length === 0 || (b.tags.length === 1 && b.tags[0] === '其他')) {
      noTagBooks++
      bookIssues.push('missing tags')
    }

    // Check chapter ordering
    let prevNum = 0, orderBad = false
    for (const ch of chs) {
      const m = ch.title.match(/第\s*(\d+)\s*章/)
      if (m) {
        const num = parseInt(m[1], 10)
        if (num < prevNum) { orderBad = true; break }
        prevNum = num
      }
    }
    if (orderBad) { badOrderBooks++; bookIssues.push('wrong chapter order') }

    // Check content quality
    let hasSource = false, hasQuoteIssue = false
    for (const ch of chs) {
      if (!ch.content) continue
      const lines = ch.content.split('\n')
      for (const line of lines) {
        // Check for 来源 with spaces
        if (/\s+来源\s+/.test(line) || /^\s*来源\s+/.test(line)) { hasSource = true }
        // Check for empty content after quote
        const qi = line.indexOf('\u201c')
        if (qi >= 0 && line.slice(qi + 1).trim().length === 0) { hasQuoteIssue = true }
      }
    }
    if (hasSource) { sourceInContent++; bookIssues.push('contains 来源') }
    if (hasQuoteIssue) { quoteIssues++; bookIssues.push('empty after quote') }

    if (bookIssues.length > 0) {
      issues.push({ id: b.id, title: b.title, chapters: chs.length, issues: bookIssues })
    }
  } catch (e) {
    issues.push({ id: b.id, title: b.title, chapters: 0, issues: ['read error: ' + e.message] })
  }
}

console.log(`\n${'='.repeat(60)}`)
console.log(`  集书阁全库彻查报告`)
console.log(`${'='.repeat(60)}`)
console.log(`  总书籍: ${totalBooks}`)
console.log(`  空章节: ${emptyBooks}`)
console.log(`  少章节(<3): ${shortBooks}`)
console.log(`  缺tag: ${noTagBooks}`)
console.log(`  章节排序错误: ${badOrderBooks}`)
console.log(`  含来源残留: ${sourceInContent}`)
console.log(`  引号后空白: ${quoteIssues}`)
console.log(`  有问题书籍: ${issues.length}`)
console.log(`${'='.repeat(60)}`)

if (issues.length > 0) {
  console.log(`\n前20本有问题书籍:`)
  issues.slice(0, 20).forEach((it, i) => {
    console.log(`  ${i+1}. ${it.title} (${it.chapters}ch) - ${it.issues.join(', ')}`)
  })
}

// Save full report
fs.writeFileSync(path.join(__dirname, '..', 'jisge-audit-report.json'), JSON.stringify(issues, null, 2))
console.log(`\n完整报告已保存到 jisge-audit-report.json`)
