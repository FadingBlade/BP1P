$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
docker compose -f .\Host\local.compose.yml logs -f
