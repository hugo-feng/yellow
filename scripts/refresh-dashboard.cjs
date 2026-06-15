const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BOOKS_DIR = path.join(ROOT, 'public', 'books');
const INDEX_FILE = path.join(BOOKS_DIR, 'index.json');
const CRAWL_FILE = path.join(ROOT, '.crawl-jisge-all.json');
const RE_FILE = path.join(ROOT, '.recrawl-progress.json');
const OUT_FILE = path.join(ROOT, 'crawler-dashboard-data.json');

function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }

// Check if crawler processes are running
function getProcessStatus() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8', timeout: 3000 });
    const nodeProcs = out.trim().split('\n').filter(l => l.includes('node.exe')).length;
    return { nodeProcesses: nodeProcs, running: nodeProcs > 2 };
  } catch { return { nodeProcesses: 0, running: false } }
}

// Get file sizes
function getFileStats() {
  let totalSize = 0, fileCount = 0;
  try {
    const files = fs.readdirSync(BOOKS_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        const stat = fs.statSync(path.join(BOOKS_DIR, f));
        totalSize += stat.size;
        fileCount++;
      }
    }
  } catch {}
  return { fileCount, totalSize };
}

const crawl = loadJSON(CRAWL_FILE, { allBooks: [], crawled: [], failed: [], discovered: [] });
const recrawl = loadJSON(RE_FILE, { done: [] });
const idx = loadJSON(INDEX_FILE, []);
const jisge = idx.filter(b => b.sourceId === 'jisge');
const proc = getProcessStatus();
const fileStat = getFileStats();

// Build crawl lookup sets
const crawledSet = new Set(crawl.crawled || []);
const failedSet = new Set(crawl.failed || []);

// Classify discovered books
const allBooks = crawl.allBooks || [];
const longBooks = allBooks.filter(b => b.isLong);
const shortBooks = allBooks.filter(b => !b.isLong);

// Build book stats
const bookStats = [];
let totalWords = 0, totalLines = 0, emptyChapters = 0;
let descClean = 0, descDirty = 0;
const chCountDist = {};

for (const b of jisge) {
  try {
    const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, b.id + '.json'), 'utf8'));
    const ch = book.chapters ? book.chapters.length : 0;
    let contentLen = 0, quoteIssues = 0, words = 0, lines = 0, emptyCh = 0;
    for (const c of (book.chapters || [])) {
      const cl = c.content ? c.content.length : 0;
      contentLen += cl;
      if (cl === 0) emptyCh++;
      if (c.content) {
        const ls = c.content.split('\n');
        lines += ls.length;
        words += c.content.replace(/\s/g, '').length;
        for (const l of ls) {
          const qi = l.indexOf('\u201c');
          if (qi >= 0 && l.slice(qi + 1).trim().length === 0) quoteIssues++;
        }
      }
    }
    totalWords += words;
    totalLines += lines;
    emptyChapters += emptyCh;

    // Description quality
    if (b.description && (b.description.includes('返回') || b.description.includes('\n') || b.description.includes('\t'))) descDirty++;
    else descClean++;

    // Chapter count distribution bucket
    const bucket = ch === 0 ? '0' : ch <= 5 ? '1-5' : ch <= 10 ? '6-10' : ch <= 20 ? '11-20' : ch <= 50 ? '21-50' : ch <= 100 ? '51-100' : '100+';
    chCountDist[bucket] = (chCountDist[bucket] || 0) + 1;

    // Crawl status for this book
    const webBook = allBooks.find(w => w.title === b.title);
    const crawlStatus = crawledSet.has(webBook?.id) ? 'crawled' : failedSet.has(webBook?.id) ? 'failed' : webBook ? 'pending' : 'no_mapping';

    bookStats.push({
      id: b.id, title: b.title, chapters: ch, contentLen, quoteIssues,
      words, lines, emptyChapters: emptyCh,
      desc: (b.description || '').slice(0, 60),
      isLong: webBook?.isLong ?? (ch > 1),
      crawlStatus,
      webId: webBook?.id || '',
      avgChapterLen: ch > 0 ? Math.round(contentLen / ch) : 0
    });
  } catch {}
}
bookStats.sort((a, b) => b.chapters - a.chapters);

// Recent activity (books sorted by modification time)
const recentBooks = [];
try {
  const files = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const withTime = files.map(f => {
    const stat = fs.statSync(path.join(BOOKS_DIR, f));
    return { file: f, mtime: stat.mtimeMs, size: stat.size };
  }).sort((a, b) => b.mtime - a.mtime).slice(0, 20);
  for (const ft of withTime) {
    try {
      const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, ft.file), 'utf8'));
      recentBooks.push({ id: book.id, title: book.title, chapters: book.chapters?.length || 0, size: ft.size, modified: new Date(ft.mtime).toISOString() });
    } catch {}
  }
} catch {}

const output = {
  crawl: {
    phase: crawl.phase,
    allBooks: allBooks.length,
    crawled: (crawl.crawled || []).length,
    failed: (crawl.failed || []).length,
    pending: allBooks.length - (crawl.crawled || []).length - (crawl.failed || []).length,
    discovered: (crawl.discovered || []).length,
    longBooks: longBooks.length,
    shortStoryBooks: shortBooks.length
  },
  recrawl: {
    done: (recrawl.done || []).length,
    total: jisge.filter(b => {
      try {
        const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, b.id + '.json'), 'utf8'));
        return (book.chapters?.length || 0) < 20;
      } catch { return false }
    }).length
  },
  index: { total: idx.length, jisge: jisge.length, other: idx.length - jisge.length },
  stats: {
    totalChapters: bookStats.reduce((s, b) => s + b.chapters, 0),
    totalContent: bookStats.reduce((s, b) => s + b.contentLen, 0),
    totalWords,
    totalLines,
    emptyChapters,
    shortBooks: bookStats.filter(b => b.chapters < 20).length,
    completeBooks: bookStats.filter(b => b.chapters >= 20).length,
    quoteIssueBooks: bookStats.filter(b => b.quoteIssues > 0).length,
    totalQuoteIssues: bookStats.reduce((s, b) => s + b.quoteIssues, 0),
    descClean,
    descDirty,
    avgChaptersPerBook: jisge.length > 0 ? (bookStats.reduce((s, b) => s + b.chapters, 0) / jisge.length).toFixed(1) : 0,
    avgContentPerBook: jisge.length > 0 ? Math.round(bookStats.reduce((s, b) => s + b.contentLen, 0) / jisge.length) : 0,
    medianChapters: (() => { const sorted = bookStats.map(b => b.chapters).sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] || 0 })(),
    maxChapters: bookStats.length > 0 ? bookStats[0].chapters : 0,
    maxChaptersBook: bookStats.length > 0 ? bookStats[0].title : ''
  },
  chCountDist,
  process: proc,
  fileStat,
  recentBooks,
  books: bookStats,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync(OUT_FILE, JSON.stringify(output));
console.log(`✅ ${new Date().toLocaleTimeString()} | 书籍:${bookStats.length} | 章节:${output.stats.totalChapters} | 内容:${(output.stats.totalContent/1024/1024).toFixed(1)}MB | 缺:${output.stats.shortBooks} | 引号:${output.stats.quoteIssueBooks}`);
