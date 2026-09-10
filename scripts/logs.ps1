$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
docker compose logs -f
