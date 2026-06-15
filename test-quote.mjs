const { JSDOM } = require('jsdom');
const dom = new JSDOM('');
const DOMPurify = require('dompurify')(dom.window);

// Simulate biquChapterParser
const html = `<html><body><div id="content">
<p>姜照雪道：\u201c青岚宗是南荒边境最大的修行宗门，弟子三万，掌三条灵脉。\u201d</p>
<p>许还山道：\u201c不是像。\u201d</p>
<p>\u201c欠债多吗？\u201d</p>
</div></body></html>`;

const doc = new JSDOM(html).window.document;
const contentEl = doc.querySelector('#content');
const content = contentEl?.textContent?.trim()
    ?.replace(/\s{2,}/g, '\n')
    ?.replace(/请收藏本站.*?$/gm, '')
    ?.replace(/最快更新.*?$/gm, '')
    ?.replace(/一秒记住.*?$/gm, '')
    ?.replace(/【.*?】/g, '')
    ?.replace(/\(本章完\)/g, '')
    || '';

const sanitized = DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
const paragraphs = sanitized.split('\n').filter(p => p.trim());

console.log('=== biquChapterParser simulation ===');
paragraphs.forEach((p, i) => console.log(`P${i}:`, JSON.stringify(p)));

// Now test the Reader's cleanPaginationMarkers
function cleanPaginationMarkers(text) {
  return text
    .replace(/第\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*页/g, '')
    .replace(/第\s*\d+\s*\/\s*\d+\s*页/g, '')
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, '')
    .replace(/更多内容加载中[。.]*\s*/g, '')
    .replace(/请稍候[。.]*\s*/g, '')
    .replace(/正在手打中[，,]*\s*请稍等片刻[，,]*/g, '')
    .replace(/内容更新后[，,]*\s*/g, '')
    .replace(/请重新刷新页面[，,]*\s*/g, '')
    .replace(/即可获取最新更新[！!]\s*/g, '')
    .replace(/正在手打中[，,]*\s*/g, '')
    .replace(/请收藏本站.*?$/gm, '')
    .replace(/最快更新.*?$/gm, '')
    .replace(/一秒记住.*?$/gm, '')
    .replace(/天才一秒.*?$/gm, '')
    .replace(/手机阅读.*?$/gm, '')
    .replace(/本章未完.*?$/gm, '')
    .replace(/章节错误.*?$/gm, '')
    .replace(/点此报错.*?$/gm, '')
    .replace(/来源[：:]\s*\S+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

console.log('\n=== After cleanPaginationMarkers ===');
const cleaned = cleanPaginationMarkers(sanitized);
const cleanParas = cleaned.split('\n').filter(p => p.trim());
cleanParas.forEach((p, i) => console.log(`P${i}:`, JSON.stringify(p)));

// Now test with a book from the jisge source
console.log('\n=== jisge book content test ===');
const book = JSON.parse(require('fs').readFileSync('public/books/book_16.json', 'utf8'));
const ch = book.chapters[0];
const origLines = ch.content.split('\n');
const quoteLines = origLines.filter(l => l.includes('\u201c') || l.includes('\u201d'));
console.log('Total lines:', origLines.length, 'Quote lines:', quoteLines.length);

// Check if any quote line has content after the quote that might be stripped
const cleanContent = DOMPurify.sanitize(ch.content, { ALLOWED_TAGS: [] });
const cleanContent2 = cleanPaginationMarkers(cleanContent);
const cleanLines = cleanContent2.split('\n');
const cleanQuoteLines = cleanLines.filter(l => l.includes('\u201c') || l.includes('\u201d'));
console.log('After sanitize+clean - Total:', cleanLines.length, 'Quote:', cleanQuoteLines.length);

// Check for differences
let diffs = 0;
for (let i = 0; i < Math.min(quoteLines.length, cleanQuoteLines.length); i++) {
  if (quoteLines[i] !== cleanQuoteLines[i]) {
    diffs++;
    if (diffs <= 3) {
      console.log('DIFF:');
      console.log('  ORIG:', JSON.stringify(quoteLines[i].slice(0,60)));
      console.log('  CLEAN:', JSON.stringify(cleanQuoteLines[i].slice(0,60)));
    }
  }
}
console.log('Total diffs:', diffs);
