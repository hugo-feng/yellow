
param([int]$StartIndex = 1, [int]$Count = 10)

$ErrorActionPreference = "Stop"
$booksDir = "F:/kilo/yellow/public/books"
$baseUrl = "https://26b.jisge.com"

if (-not (Test-Path $booksDir)) {
    New-Item -ItemType Directory -Path $booksDir -Force | Out-Null
}

$books = @(
    @{ idx=1;  url="/content_ffff9172dd0c5e22ac4210690435b1ff.html"; name="惭莺的故事" },
    @{ idx=2;  url="/content_fffa30bfefdc5448a2ddd789ebb61738.html"; name="变成室友男朋友的专属性奴" },
    @{ idx=3;  url="/content_ffe59e42277a538096f92693f50519b7.html"; name="真实的刺激经验 (朋友妻)" },
    @{ idx=4;  url="/content_ffe458da9fec51f7be6a5485dbbc83c2.html"; name="２次３Ｐ的经验" },
    @{ idx=5;  url="/content_ffddd0a517245b50b811fff77f61f6c1.html"; name="目标！百人斩" },
    @{ idx=6;  url="/content_ffcecac79e4b5e75850329e9800ed21e.html"; name="满汉全席" },
    @{ idx=7;  url="/content_ffcc08e87bb35ba784af7fe025738edb.html"; name="少妇孙宁之偷汉" },
    @{ idx=8;  url="/content_ffcb49dd269e567bade1b96387e60901.html"; name="强暴" },
    @{ idx=9;  url="/content_ffb102b529af58b8ba20e0c5c19eaefc.html"; name="爱上迷奸的刺激" },
    @{ idx=10; url="/content_ffa960f8f3dd53e79510512a8dd7fd22.html"; name="母子情似胶" }
)

Add-Type -AssemblyName System.Web

$indexData = @()

foreach ($book in $books[$($StartIndex-1)..$($StartIndex+$Count-2)]) {
    $idx = $book.idx
    $name = $book.name
    $fullUrl = $baseUrl + $book.url

    Write-Host "Processing book_$idx : $name" -ForegroundColor Cyan

    try {
        $response = Invoke-WebRequest -Uri $fullUrl -TimeoutSec 15 -UseBasicParsing

        # Extract title from .content-title div:last-child
        if ($response.Content -match '<div class="single-strong content-title".*?<div[^>]*>.*?</div>\s*<div[^>]*>(.*?)</div>') {
            $extractedTitle = $Matches[1].Trim()
        } else {
            $extractedTitle = $name
        }

        # Extract #bookcontent text
        if ($response.Content -match '<div id="bookcontent".*?>(.*?)</div>\s*</div>\s*<div class="clear">') {
            $rawContent = $Matches[1]
        } elseif ($response.Content -match '<div id="bookcontent".*?>(.*)</div>') {
            $rawContent = $Matches[1]
        } else {
            Write-Warning "Cannot find #bookcontent for $name"
            continue
        }

        # Clean content:
        # 1. Remove all HTML tags (both standard and obfuscated ones like <abc>, <a1b2>, <uah8->, etc.)
        $clean = $rawContent -replace '<[^>]*>', ''

        # 2. HTML decode
        $clean = [System.Web.HttpUtility]::HtmlDecode($clean)

        # 3. Remove "来源 xxx" patterns
        $clean = $clean -replace '来源\s*jishuge[^\s]*', ''
        $clean = $clean -replace '来源\s*集书阁[^\s]*', ''
        $clean = $clean -replace '来源[：:]\s*集书阁[^\s]*', ''
        $clean = $clean -replace '来源[：:]\s*jishuge[^\s]*', ''
        $clean = $clean -replace 'jishuge\.one', ''
        $clean = $clean -replace 'jishuge\.vip', ''
        $clean = $clean -replace 'jishuge\.com', ''
        $clean = $clean -replace '集书阁\.com', ''
        $clean = $clean -replace '集书阁', ''

        # 4. Remove "canovel.com" type junk
        $clean = $clean -replace 'canovel\.com', ''

        # 5. Collapse whitespace (but preserve paragraph breaks)
        $clean = $clean -replace '\s+', ' '
        $clean = $clean.Trim()

        # Count characters
        $charCount = $clean.Length

        Write-Host "  Title: $extractedTitle" -ForegroundColor Green
        Write-Host "  Characters: $charCount" -ForegroundColor Yellow

        # Build JSON
        $bookJson = @{
            id = "book_$idx"
            title = $extractedTitle
            author = ""
            description = "短篇情色小说 - 来自集书阁"
            sourceId = "jisge"
            sourceName = "集书阁"
            chapters = @(
                @{
                    id = "ch1"
                    title = "正文"
                    index = 0
                    url = $fullUrl
                    content = $clean
                    cached = $true
                }
            )
        } | ConvertTo-Json -Depth 4 -Compress

        $outPath = Join-Path $booksDir "book_$idx.json"
        [System.IO.File]::WriteAllText($outPath, $bookJson, [System.Text.Encoding]::UTF8)
        Write-Host "  Written: $outPath" -ForegroundColor Green

        $indexData += @{
            id = "book_$idx"
            title = $extractedTitle
            author = ""
            description = "短篇情色小说 - 来自集书阁"
            cover = ""
        }
    } catch {
        Write-Warning "Failed to fetch $name : $_"
    }
}

# Write index.json
$indexPath = Join-Path $booksDir "index.json"
$indexJson = $indexData | ConvertTo-Json -Depth 2 -Compress
[System.IO.File]::WriteAllText($indexPath, $indexJson, [System.Text.Encoding]::UTF8)
Write-Host "`nIndex written: $indexPath ($($indexData.Count) books)" -ForegroundColor Green
