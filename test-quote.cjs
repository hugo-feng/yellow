const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify')(new JSDOM('').window);

const html = '<div id="content"><p>\u5c0f\u514b\u8bf4\uff1a\u201c\u4f60\u597d\u554a\u201d</p><p>\u201c\u4eca\u5929\u4e0d\u9519\u201d</p></div>';
const doc = new JSDOM(html).window.document;
const el = doc.querySelector('#content');
const raw = el.textContent.trim().replace(/\s{2,}/g, '\n');
const sanitized = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [] });
console.log('raw:', JSON.stringify(raw));
console.log('sanitized:', JSON.stringify(sanitized));

// Now check what happens with innerHTML
console.log('innerHTML:', el.innerHTML);
console.log('textContent:', el.textContent);
