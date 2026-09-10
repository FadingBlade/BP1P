$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$directory=(Read-Host 'Public BP1P Directory URL').TrimEnd('/')
if(-not $directory){throw 'Directory URL is required.'}
$k=Invoke-RestMethod "$directory/api/public-key"
$template=Get-Content (Join-Path $root 'Client\BP1P.template.html') -Raw
$template=$template.Replace('__BP1P_DIRECTORY_URL__',$directory).Replace('__BP1P_DIRECTORY_KEY__',$k.publicKey)
Set-Content (Join-Path $root 'Client\BP1P.html') $template -Encoding UTF8
Write-Host ''
Write-Host 'Client\BP1P.html is paired and ready to distribute.' -ForegroundColor Green
Write-Host "Default directory: $directory"
Write-Host 'Users only need to double-click BP1P.html. They do not need Docker.'
