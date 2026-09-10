$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host 'Rebuilding BP1P nodes from the current package...' -ForegroundColor Cyan
docker compose pull --ignore-buildable 2>$null
docker compose up -d --build --force-recreate
Write-Host 'BP1P node stack rebuilt and restarted.' -ForegroundColor Green
