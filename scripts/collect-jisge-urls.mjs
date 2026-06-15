import puppeteer from 'puppeteer-core'
import fs from 'fs'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

  let allBookUrls = []

  for (let i = 1; i <= 9; i++) {
    const url = `https://www.xn--1jqvh729avzfcy2d8ummib.com/sitemap-${i}.xml`
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(2000)
      const urls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('url > loc'))
          .map(el => el.textContent.trim())
          .filter(u => u.includes('content_') || u.includes('contentlist_'))
      })
      allBookUrls.push(...urls)
      console.log(`sitemap-${i}: ${urls.length} book URLs`)
    } catch(e) { console.log(`sitemap-${i}: error - ${e.message}`) }
  }

  console.log(`\nTotal book URLs: ${allBookUrls.length}`)

  const converted = allBookUrls.map(u =>
    u.replace('https://www.xn--1jqvh729avzfcy2d8ummib.com/', 'https://jishuge.one/')
  )
  const unique = [...new Set(converted)]
  console.log('Unique book URLs:', unique.length)

  fs.writeFileSync('.jisge-all-urls.json', JSON.stringify(unique, null, 2))
  console.log('Saved to .jisge-all-urls.json')

  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
