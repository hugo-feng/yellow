async function test() {
  // Test search on new working sources
  const tests = [
    { name: 'xbiqugu', url: 'https://www.xbiqugu.com/modules/article/search.php?searchkey=' + encodeURIComponent('盘龙') },
    { name: 'biquxia', url: 'https://www.biquxia.com/modules/article/search.php?searchkey=' + encodeURIComponent('盘龙') },
    { name: 'mibaoge', url: 'https://www.xinmiaobige.net/search.html?keyword=' + encodeURIComponent('盘龙') },
    { name: 'biquwo', url: 'https://www.biquwo.com/search?keyword=' + encodeURIComponent('盘龙') },
    { name: 'qula', url: 'https://www.qu-la.com/search?keyword=' + encodeURIComponent('盘龙') },
    { name: 'biquhi', url: 'https://www.biquhi.com/search?keyword=' + encodeURIComponent('盘龙') },
    { name: 'biqule2', url: 'https://www.biqule.net/search.html?searchkey=' + encodeURIComponent('盘龙') },
  ]
  
  for (const { name, url } of tests) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
      })
      const buf = await resp.arrayBuffer()
      let html = new TextDecoder('utf-8').decode(buf)
      if (html.includes('�') || html.includes('\ufffd')) html = new TextDecoder('gbk').decode(buf)
      
      const linkRe = /href="([^"]+)"[^>]*>([^<]{2,40})/g
      const links = []
      let m
      while ((m = linkRe.exec(html)) !== null) {
        const href = m[1]
        const text = m[2].trim()
        if (text.length > 1 && text.length < 30 && href.length > 3 && !href.includes('css') && !href.includes('js') && !href.includes('search') && !href.includes('login') && !href.includes('register')) {
          links.push({ href, text })
        }
      }
      
      const bookLinks = links.filter(l => {
        const h = l.href
        return (h.match(/\/wapbook\/\d+/) || h.match(/\/\d+\/\d+/) || h.match(/\/booktxt\//) || h.match(/\/shu\/\d+/) || h.match(/\/bqw\d+/) || h.match(/\/book\/\d+/)) && !h.includes('/list') && !h.includes('/class')
      })
      
      const hasExact = links.some(l => l.text.includes('盘龙') && l.text.length < 10)
      
      console.log(`${name}: HTTP ${resp.status}, bookLinks=${bookLinks.length}, exactMatch=${hasExact}`)
      if (bookLinks.length > 0) {
        for (const b of bookLinks.slice(0, 3)) console.log(`  ${b.href} => ${b.text}`)
      }
    } catch(e) {
      console.log(`${name}: ERROR ${e.message}`)
    }
  }
}
test()
