const fs = require('fs')
const path = require('path')

const BOOKS_DIR = path.join(__dirname, '..', 'public', 'books')
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json')
const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))

function generateTags(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase()
  const tagMap = {
    '玄幻': ['玄幻','奇幻'], '都市': ['都市','现代'], '修仙': ['修仙','仙侠'], '重生': ['重生'],
    '穿越': ['穿越','异世'], '言情': ['言情','爱情'], '科幻': ['科幻','未来'], '历史': ['历史','古代'],
    '武侠': ['武侠','江湖'], '悬疑': ['悬疑','推理'], '末世': ['末世','废土'], '灵异': ['灵异','恐怖'],
    '军事': ['军事','战争'], '网游': ['网游','游戏'], '校园': ['校园','青春'], '仙侠': ['仙侠','修真'],
    '奇幻': ['奇幻','魔法'], '赘婿': ['赘婿','逆袭'], '系统': ['系统','穿越'], '快穿': ['快穿','穿越'],
    '盗墓': ['盗墓','探险'], '种田': ['种田','田园'], '女强': ['女强','言情'], '古言': ['古言','古代'],
    '现言': ['现言','现代'], '洪荒': ['洪荒','封神'], '西游': ['西游','神话']
  }
  const tags = new Set()
  for (const [key, vals] of Object.entries(tagMap)) {
    if (text.includes(key)) vals.forEach(t => tags.add(t))
  }
  return tags.size > 0 ? [...tags].slice(0, 3) : ['其他']
}

function cleanContent(text) {
  if (!text) return ''
  return text
    .replace(/来源\s{2,}/g, '')
    .replace(/\s{2,}来源/g, '')
    .replace(/\s+来源\s+/g, '')
    .replace(/^\s*来源\s*/gm, '')
    .replace(/\s+来源\s*$/gm, '')
    .replace(/来源[：:]\s*https?:\/\/\S+/g, '')
    .replace(/来源[：:]\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\S*/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

let fixedSource = 0, fixedTags = 0, fixedOrder = 0, totalFixed = 0

for (const b of idx) {
  if (b.sourceId !== 'jisge') continue
  
  let changed = false
  
  // Fix tags
  if (!b.tags || b.tags.length === 0 || (b.tags.length === 1 && b.tags[0] === '其他')) {
    b.tags = generateTags(b.title, b.description)
    fixedTags++
    changed = true
  }
  
  try {
    const filePath = path.join(BOOKS_DIR, b.id + '.json')
    const book = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    let bookChanged = false
    
    // Fix chapter ordering
    const chs = book.chapters || []
    if (chs.length > 1) {
      const withNum = chs.map(ch => {
        const m = ch.title.match(/第\s*(\d+)\s*章/)
        return { ch, num: m ? parseInt(m[1], 10) : ch.index }
      })
      const isSorted = withNum.every((item, i) => i === 0 || item.num >= withNum[i-1].num)
      if (!isSorted) {
        withNum.sort((a, b) => a.num - b.num)
        book.chapters = withNum.map((item, i) => ({ ...item.ch, index: i }))
        fixedOrder++
        bookChanged = true
      }
    }
    
    // Fix 来源 in content
    for (const ch of (book.chapters || [])) {
      if (!ch.content) continue
      const cleaned = cleanContent(ch.content)
      if (cleaned !== ch.content) {
        ch.content = cleaned
        bookChanged = true
      }
    }
    
    if (bookChanged) {
      fs.writeFileSync(filePath, JSON.stringify(book, null, 2))
      fixedSource++
      changed = true
    }
  } catch {}
  
  if (changed) totalFixed++
}

// Save updated index
fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2))

console.log(`\n修复完成:`)
console.log(`  来源残留修复: ${fixedSource} 本`)
console.log(`  Tag补充: ${fixedTags} 本`)
console.log(`  章节排序修复: ${fixedOrder} 本`)
console.log(`  总修改: ${totalFixed} 本`)
