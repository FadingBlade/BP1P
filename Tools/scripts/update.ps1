$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
Write-Host 'Updating/rebuilding BP1P from the files in this release...' -ForegroundColor Cyan
docker compose -f .\Host\local.compose.yml pull --ignore-buildable 2>$null
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
Write-Host 'BP1P rebuilt and restarted.' -ForegroundColor Green
