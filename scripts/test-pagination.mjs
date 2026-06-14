async function test() {
  // Test chapter page variations on biquqi
  const baseUrl = 'https://www.biquqi.com/book/0/262/282412'
  const variations = [
    baseUrl + '.html',
    baseUrl + '_2.html',
    baseUrl + '_3.html',
    baseUrl + '?page=2',
    baseUrl + '?page=3',
  ]
  
  for (const url of variations) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000)
      })
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        let html = new TextDecoder('utf-8').decode(buf)
        if (html.includes('\ufffd')) html = new TextDecoder('gbk').decode(buf)
        
        const artRe = /<article[^>]*>([\s\S]*?)<\/article>/i
        const artMatch = html.match(artRe)
        const text = artMatch ? artMatch[1].replace(/<[^>]+>/g, '').trim() : ''
        
        console.log(url.split('/').pop() + ': HTTP ' + resp.status + ', content=' + text.length + 'chars')
        if (text.length > 0) console.log('  First 100:', text.substring(0, 100))
      } else {
        console.log(url.split('/').pop() + ': HTTP ' + resp.status)
      }
    } catch(e) {
      console.log(url.split('/').pop() + ': ERROR ' + e.message)
    }
  }
  
  // Also test bqukan
  console.log('\n--- bqukan ---')
  const bqukanUrl = 'https://www.bqukan.com/book/hd20/b'
  const bqukanVars = [
    bqukanUrl + '.html',
    bqukanUrl + '_2.html',
    bqukanUrl + '_3.html',
  ]
  
  for (const url of bqukanVars) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000)
      })
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        let html = new TextDecoder('utf-8').decode(buf)
        if (html.includes('\ufffd')) html = new TextDecoder('gbk').decode(buf)
        
        const artRe = /<article[^>]*>([\s\S]*?)<\/article>/i
        const artMatch = html.match(artRe)
        const text = artMatch ? artMatch[1].replace(/<[^>]+>/g, '').trim() : ''
        
        const contentRe = /<div[^>]*id=["']chaptercontent["'][^>]*>([\s\S]*?)<\/div>/i
        const contentMatch = html.match(contentRe)
        const ctext = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : ''
        
        const best = text.length > ctext.length ? text : ctext
        console.log(url.split('/').pop() + ': HTTP ' + resp.status + ', content=' + best.length + 'chars')
        if (best.length > 0) console.log('  First 100:', best.substring(0, 100))
      } else {
        console.log(url.split('/').pop() + ': HTTP ' + resp.status)
      }
    } catch(e) {
      console.log(url.split('/').pop() + ': ERROR ' + e.message)
    }
  }
}
test()
