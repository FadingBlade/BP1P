$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
docker compose up -d --build --force-recreate
Write-Host 'BP1P started. Open BP1P.html or http://localhost:8787' -ForegroundColor Green
