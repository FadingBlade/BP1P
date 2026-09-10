$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
Write-Host 'Starting BP1P host...' -ForegroundColor Cyan
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
Write-Host 'Waiting for the directory...' -ForegroundColor DarkGray
$ok=$false
for($i=0;$i -lt 40;$i++){
  try{$k=Invoke-RestMethod 'http://localhost:8080/api/public-key';$ok=$true;break}catch{Start-Sleep -Milliseconds 750}
}
if(-not $ok){throw 'BP1P directory did not become ready. Open Tools\LOGS.cmd.'}
$template=Get-Content (Join-Path $root 'Client\BP1P.template.html') -Raw
$template=$template.Replace('__BP1P_DIRECTORY_URL__','http://localhost:8080').Replace('__BP1P_DIRECTORY_KEY__',$k.publicKey)
Set-Content (Join-Path $root 'Client\BP1P.html') $template -Encoding UTF8
Write-Host ''
Write-Host 'BP1P is ready.' -ForegroundColor Green
Write-Host 'Double-click client: Client\BP1P.html'
Write-Host 'Directory API:      http://localhost:8080'
Write-Host 'Node Console:       http://localhost:8787'
Write-Host 'Directory Console:  http://localhost:8790'
Write-Host 'Both admin tokens:  1'
Start-Process (Join-Path $root 'Client\BP1P.html')
Start-Process 'http://localhost:8787'
