# zip-soa-group.ps1

# مسارات مبنية على مكان السكربت
$ProjectRoot = $PSScriptRoot          # مثال: D:\programmer\soa_group
$TempPath    = Join-Path $env:TEMP "soa-group-temp"
$ZipPath     = Join-Path $ProjectRoot "soa-group.zip"

# تنظيف المؤقت
if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }
New-Item -ItemType Directory -Path $TempPath | Out-Null

# نمط الاستثناءات
$excludePattern = [regex]"\\node_modules\\|\\\.next\\|\\\.git\\|\\\.env$|\.log$"

# اجلب "الملفات فقط" من جذر المشروع مع تجنّب الروابط الرمزية
Get-ChildItem -Path $ProjectRoot -Recurse -Force -File -Attributes !ReparsePoint -ErrorAction SilentlyContinue |
    Where-Object {
        # استبعد الملفات/المسارات المطابقة للنمط
        $_.FullName -notmatch [regex]::Escape($TempPath) -and
        $_.FullName -notmatch [regex]::Escape($ZipPath)  -and
        $_.FullName -notmatch $excludePattern
    } |
    ForEach-Object {
        $dest = $_.FullName.Replace($ProjectRoot, $TempPath)
        $destDir = Split-Path -Parent $dest
        if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue
    }

# ضغط المحتوى
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path (Join-Path $TempPath '*') -DestinationPath $ZipPath -Force

# حذف المؤقت
Remove-Item -Recurse -Force $TempPath

Write-Host "`n Success: $ZipPath`n"
# تشغيل:  powershell -ExecutionPolicy Bypass -File .\zip-soa-group.ps1
