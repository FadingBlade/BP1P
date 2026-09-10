$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host 'Starting BP1P...' -ForegroundColor Cyan
docker compose up -d --build --force-recreate
Write-Host 'Waiting for directory...' -ForegroundColor DarkGray
$ok=$false
for($i=0;$i -lt 40;$i++){
  try { $k=Invoke-RestMethod 'http://localhost:8080/api/public-key'; $ok=$true; break } catch { Start-Sleep -Milliseconds 750 }
}
if(-not $ok){ throw 'BP1P directory did not become ready. Run: docker compose logs' }
$template=Get-Content (Join-Path $root 'client\BP1P.html') -Raw
$template=$template.Replace('__BP1P_DIRECTORY_URL__','http://localhost:8080').Replace('__BP1P_DIRECTORY_KEY__',$k.publicKey)
Set-Content (Join-Path $root 'BP1P.html') $template -Encoding UTF8
Write-Host ''
Write-Host 'BP1P is ready.' -ForegroundColor Green
Write-Host 'Client:            BP1P.html'
Write-Host 'Node Console:      http://localhost:8787'
Write-Host 'Directory Console: http://localhost:8790'
Write-Host 'Node token:        bp1p-local-node-admin'
Write-Host 'Directory token:   bp1p-local-directory-admin'
Write-Host ''
Start-Process (Join-Path $root 'BP1P.html')
Start-Process 'http://localhost:8787'
