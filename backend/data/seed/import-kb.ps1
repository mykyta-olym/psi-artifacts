# Import Knowledge Base articles
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYXJlay5ob3J2YXRoQHR1a2Uuc2siLCJqdGkiOiIwNTVhYTRhOTJhYjA0YTBhOTgxNzU1NDNmZTkxMzNjNCIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL2VtYWlsYWRkcmVzcyI6Im1hcmVrLmhvcnZhdGhAdHVrZS5zayIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6InRlYWNoZXIiLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwibmJmIjoxNzY0MDc0MDE4LCJleHAiOjE3NjQwNzU4MjgsImlzcyI6Im1haXMubG9jYWwiLCJhdWQiOiJtYWlzLmxvY2FsIn0.rhUXfXP2aE7RcaFa8qXUZbAJA_lew_5lOjQ2ZZOKW8Y"
$apiUrl = "http://localhost:5000/api/knowledge-base/articles"

$articles = Get-Content "knowledge-base.json" -Raw | ConvertFrom-Json

$imported = 0
$failed = 0

foreach ($article in $articles) {
    Write-Host "Importing: $($article.title)..." -NoNewline
    
    $body = @{
        title = $article.title
        content = $article.content
        category = $article.category
        tags = $article.tags
        difficulty = $article.difficulty
        isPublished = $article.isPublished
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json" -Headers @{
            "Authorization" = "Bearer $token"
        }
        Write-Host " ✓ Success (ID: $($response.id))" -ForegroundColor Green
        $imported++
    }
    catch {
        Write-Host " ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
    
    Start-Sleep -Milliseconds 200
}

Write-Host "`n=== Import Complete ===" -ForegroundColor Cyan
Write-Host "Imported: $imported" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
