$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$directory=Read-Host 'Directory URL (example https://directory.example.com)'
$directory=$directory.TrimEnd('/')
$k=Invoke-RestMethod "$directory/api/public-key"
$template=Get-Content (Join-Path $root 'client\BP1P.html') -Raw
$template=$template.Replace('__BP1P_DIRECTORY_URL__',$directory).Replace('__BP1P_DIRECTORY_KEY__',$k.publicKey)
Set-Content (Join-Path $root 'BP1P.html') $template -Encoding UTF8
Write-Host 'BP1P.html paired successfully.' -ForegroundColor Green
