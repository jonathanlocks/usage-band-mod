# Baixa a versão portátil (zip) do Windows Terminal, confere o SHA-256 e extrai. Os runners do
# GitHub não têm o Windows Terminal; esta é a forma de ver a banda nele.
#   ./terminal-portatil.ps1 -Versao 1.25.2733.0 -Sha256X64 <hash> -Sha256Arm64 <hash> -Destino wt
param(
  [Parameter(Mandatory)][string]$Versao,
  [Parameter(Mandatory)][string]$Sha256X64,
  [Parameter(Mandatory)][string]$Sha256Arm64,
  [Parameter(Mandatory)][string]$Destino
)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'terminal-portatil.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele baixa e extrai o Windows Terminal portátil. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
$arq = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$esperado = if ($arq -eq 'arm64') { $Sha256Arm64 } else { $Sha256X64 }
$nome = "Microsoft.WindowsTerminal_${Versao}_$arq.zip"
$url = "https://github.com/microsoft/terminal/releases/download/v$Versao/$nome"
$zip = Join-Path $env:RUNNER_TEMP $nome
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $esperado.ToLowerInvariant()) { throw "SHA-256 do $nome não confere: $hash (esperado $esperado)" }
Expand-Archive $zip -DestinationPath $Destino -Force
$exe = Get-ChildItem $Destino -Recurse -Filter WindowsTerminal.exe | Select-Object -First 1
if (-not $exe) { throw 'WindowsTerminal.exe não está no zip' }
# Modo portátil: as configurações ficam na pasta, sem tocar no perfil do usuário. Fonte 9 e 122
# colunas no canto da tela: a banda (118 colunas) cabe numa linha na tela de 1024 px do runner.
New-Item -ItemType File (Join-Path $exe.DirectoryName '.portable') -Force | Out-Null
$config = Join-Path $exe.DirectoryName 'settings'
New-Item -ItemType Directory $config -Force | Out-Null
$json = '{ "initialCols": 122, "initialRows": 10, "initialPosition": "0,0", "profiles": { "defaults": { "font": { "size": 9 } } } }'
[IO.File]::WriteAllText((Join-Path $config 'settings.json'), $json, (New-Object Text.UTF8Encoding $false))
Write-Host "Windows Terminal $Versao ($arq) em $($exe.FullName)"
$exe.FullName
