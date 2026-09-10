$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
Write-Host 'BP1P started.' -ForegroundColor Green
