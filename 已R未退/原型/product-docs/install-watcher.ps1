$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$install = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'AI-NATIVE-SDLC\RefundProductDocs'
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup '已R未退 - 同步产品文档.lnk'
$description = 'AI-NATIVE-SDLC 已R未退产品文档'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ((Test-Path -LiteralPath $shortcutPath) -and $shortcut.Description -ne $description) { throw '启动目录中已存在同名的其他快捷方式。' }
New-Item -ItemType Directory -Path (Join-Path $install 'vendor') -Force | Out-Null
foreach ($name in 'build.cjs','watch.cjs','page.html','vendor/marked.cjs','vendor/LICENSE-Marked.md') {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $install $name) -Force
}
function Quote-PSArgument([string]$value) { "'" + $value.Replace("'", "''") + "'" }
$watch = Join-Path $install 'watch.cjs'
$launch = '& ' + (Quote-PSArgument $nodeExe) + ' ' + (Quote-PSArgument $watch) + ' ' + (Quote-PSArgument $project) + '; exit $LASTEXITCODE'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.TargetPath = $powershell
$shortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + $launch + '"'
$shortcut.WorkingDirectory = $install
$shortcut.Description = $description
$shortcut.WindowStyle = 7
$shortcut.Save()
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($watch) -and $_.CommandLine.Contains($project) }
if (-not $running) {
    $process = Start-Process -FilePath $nodeExe -ArgumentList @('"' + $watch + '"', '"' + $project + '"') -WorkingDirectory $install -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { throw '本地监听没有成功启动。' }
}
if (-not (Test-Path -LiteralPath $shortcutPath)) { throw '未能保存当前用户的启动项。' }
'已启用本地监听和当前用户登录时自动启动。'
