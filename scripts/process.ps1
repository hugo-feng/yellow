$booksDir = "F:/kilo/yellow/public/books"
if (-not (Test-Path $booksDir)) { New-Item -ItemType Directory -Path $booksDir -Force | Out-Null }

function Clean-Text($raw) {
    $c = $raw -replace "来源\s*[：:]*\s*集书阁[^\s]*", ""
    $c = $c -replace "来源\s*[：:]*\s*jishuge[^\s]*", ""
    $c = $c -replace "jishuge\.\w+", ""
    $c = $c -replace "集书阁\s*\.com", ""
    $c = $c -replace "集书阁\s*\.\w+", ""
    $c = $c -replace "canovel\.com", ""
    $c = $c -replace "\s+", " "
    return $c.Trim()
}

function Write-Book($id, $title, $url, $rawText) {
    $clean = Clean-Text $rawText
    $json = "{`"id`":`"$id`",`"title`":`"$title`",`"author`":`"`",`"description`":`"short novel from jisge`",`"sourceId`":`"jisge`",`"sourceName`":`"jisge`",`"chapters`":[{`"id`":`"ch1`",`"title`":`"text`",`"index`":0,`"url`":`"$url`",`"content`":`"$($clean -replace '"','\"' -replace '\r?\n',' ')`",`"cached`":true}]}"
    $path = Join-Path $booksDir "$id.json"
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "$id : $title ($($clean.Length) chars)"
    return @{id=$id; title=$title; author=""; description="short novel from jisge"; cover=""}
}

$index = @()
$base = "https://26b.jisge.com"
