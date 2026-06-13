import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BOOKS_DIR = resolve('F:/kilo/yellow/public/books');
const TMP_DIR = resolve('F:/kilo/yellow/tmp');
const BASE_URL = 'https://26b.jisge.com';

mkdirSync(BOOKS_DIR, { recursive: true });

function cleanText(raw) {
    let c = raw
        .replace(/来源\s*[：:]*\s*集书阁[^\s]*/g, '')
        .replace(/来源\s*[：:]*\s*jishuge[^\s]*/g, '')
        .replace(/jishuge\.\w+/g, '')
        .replace(/集书阁\s*\.com/g, '')
        .replace(/集书阁\s*\.\w+/g, '')
        .replace(/canovel\.com/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return c;
}

function writeBook(id, title, urlPath, rawText) {
    const cleaned = cleanText(rawText);
    const book = {
        id,
        title,
        author: '',
        description: 'short novel from jisge',
        sourceId: 'jisge',
        sourceName: 'jisge',
        chapters: [{
            id: 'ch1',
            title: 'text',
            index: 0,
            url: BASE_URL + urlPath,
            content: cleaned,
            cached: true
        }]
    };
    const outPath = join(BOOKS_DIR, `${id}.json`);
    writeFileSync(outPath, JSON.stringify(book), 'utf-8');
    console.log(`${id}: ${title} (${cleaned.length} chars)`);
    return { id, title, author: '', description: book.description, cover: '' };
}

const books = [
    { id: 'book_1', title: '惭莺的故事', url: '/content_ffff9172dd0c5e22ac4210690435b1ff.html', file: 'book_1.txt' },
    { id: 'book_2', title: '变成室友男朋友的专属性奴', url: '/content_fffa30bfefdc5448a2ddd789ebb61738.html', file: 'book_2.txt' },
    { id: 'book_3', title: '真实的刺激经验 (朋友妻)', url: '/content_ffe59e42277a538096f92693f50519b7.html', file: 'book_3.txt' },
    { id: 'book_4', title: '２次３Ｐ的经验', url: '/content_ffe458da9fec51f7be6a5485dbbc83c2.html', file: 'book_4.txt' },
    { id: 'book_5', title: '目标！百人斩', url: '/content_ffddd0a517245b50b811fff77f61f6c1.html', file: 'book_5.txt' },
    { id: 'book_6', title: '满汉全席', url: '/content_ffcecac79e4b5e75850329e9800ed21e.html', file: 'book_6.txt' },
    { id: 'book_7', title: '少妇孙宁之偷汉', url: '/content_ffcc08e87bb35ba784af7fe025738edb.html', file: 'book_7.txt' },
    { id: 'book_8', title: '强暴', url: '/content_ffcb49dd269e567bade1b96387e60901.html', file: 'book_8.txt' },
    { id: 'book_9', title: '爱上迷奸的刺激', url: '/content_ffb102b529af58b8ba20e0c5c19eaefc.html', file: 'book_9.txt' },
    { id: 'book_10', title: '母子情似胶', url: '/content_ffa960f8f3dd53e79510512a8dd7fd22.html', file: 'book_10.txt' },
];

const indexData = [];

for (const book of books) {
    try {
        const filePath = join(TMP_DIR, book.file);
        const raw = readFileSync(filePath, 'utf-8');
        const entry = writeBook(book.id, book.title, book.url, raw);
        indexData.push(entry);
    } catch (err) {
        console.error(`Failed ${book.id}: ${err.message}`);
    }
}

// Write index.json
const indexPath = join(BOOKS_DIR, 'index.json');
writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
console.log(`\nIndex written: ${indexPath} (${indexData.length} books)`);
