$files = Get-ChildItem "c:\Users\Rishabh Jain\Desktop\Wellness Point\src\app" -Recurse -Filter "*.tsx"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "dark:") {
        $newContent = $content -replace "\s+dark:[a-zA-Z0-9\[\]\(\)\/._:-]+", ""
        Set-Content $file.FullName -Value $newContent -NoNewline
        Write-Host "Cleaned: $($file.FullName)"
    }
}
