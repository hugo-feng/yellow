import puppeteer from 'puppeteer-core'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

  // Test a multi-chapter book
  const url = 'https://26b.jisge.com/contentlist_3266.html'
  console.log('Fetching:', url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(3000)

  const result = await page.evaluate(() => {
    const title = document.title
    const ucontent = document.querySelectorAll('ul.ucontent li a')
    const anyList = document.querySelectorAll('li a')
    const h1 = document.querySelector('h1')?.textContent
    const body = document.body?.innerHTML?.slice(0, 500)
    return {
      title,
      ucontentCount: ucontent.length,
      anyListCount: anyList.length,
      h1,
      bodyPreview: body
    }
  })

  console.log('Title:', result.title)
  console.log('ucontent links:', result.ucontentCount)
  console.log('any li a links:', result.anyListCount)
  console.log('H1:', result.h1)
  console.log('Body preview:', result.bodyPreview?.slice(0, 300))

  await browser.close()
}

main().catch(e => console.error(e))
