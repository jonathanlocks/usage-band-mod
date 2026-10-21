# Instala o mod como uma pessoa faria, a partir desta cópia do repositório, e confere o que o
# INSTALL-WINDOWS.md promete: o plugin aparece habilitado, a checagem do .NET Framework dá o que o
# guia diz, o PainelDeUso.exe chega intacto à pasta do plugin e abre de lá, e desinstalar funciona.
# Não precisa de login.   pwsh windows/ci/instalar-plugin.ps1 -Saida out/instalacao.txt
param([string]$Saida)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'instalar-plugin.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele instala, desabilita e desinstala o usage-band-mod e remove o marketplace dele das configurações do Claude Code. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$registro = New-Object Collections.Generic.List[string]
function Anotar([string]$t) { Write-Host $t; $registro.Add($t) }
function Rodar([string]$titulo, [scriptblock]$bloco) {
  Anotar "> $titulo"
  $saida = & $bloco 2>&1 | Out-String
  foreach ($l in ($saida.TrimEnd() -split "`r?`n")) { Anotar "  $l" }
  return $saida
}

Rodar 'claude --version' { claude --version } | Out-Null
Rodar 'where.exe claude' { where.exe claude } | Out-Null
Rodar '[Environment]::OSVersion.Version.Build' { [Environment]::OSVersion.Version.Build } | Out-Null
$reg = Rodar 'reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release' { reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release }
if ($reg -notmatch 'Release\s+REG_DWORD\s+0x([0-9a-f]+)' -or [Convert]::ToInt32($Matches[1], 16) -lt 528040) { throw '.NET Framework 4.8 não encontrado' }
Rodar 'claude auth status' { claude auth status } | Out-Null

# 1. Do GitHub, como no guia: confere o caminho da cópia em cache que o guia cita. O repositório
#    público ainda está na versão sem Windows; aqui só importa o caminho e os comandos.
$cache = Join-Path $env:USERPROFILE '.claude\plugins\cache\usage-band-mod'
$inst = Rodar 'claude plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod' {
  claude plugin install usage-band-mod --marketplace jonathanlocks/usage-band-mod --config idioma=en --config moeda=USD --config mascote=animado --config limitePorModelo=true
}
if ($inst -notmatch 'Successfully installed plugin: usage-band-mod@usage-band-mod') { throw 'a instalação pelo GitHub não deu certo' }
$lista = Rodar 'claude plugin list' { claude plugin list }
if ($lista -notmatch 'usage-band-mod@usage-band-mod' -or $lista -notmatch 'enabled') { throw 'o plugin não aparece habilitado' }
Anotar "> cópia em cache: $cache -> $(if (Test-Path $cache) { 'existe' } else { 'NÃO existe' })"
if (-not (Test-Path $cache)) { throw "a cópia em cache não está em $cache" }
Rodar 'claude plugin disable usage-band-mod@usage-band-mod' { claude plugin disable usage-band-mod@usage-band-mod } | Out-Null
if ((claude plugin list | Out-String) -notmatch 'disabled') { throw 'disable não desabilitou' }
Rodar 'claude plugin enable usage-band-mod@usage-band-mod' { claude plugin enable usage-band-mod@usage-band-mod } | Out-Null
Rodar 'claude plugin update usage-band-mod@usage-band-mod' { claude plugin update usage-band-mod@usage-band-mod } | Out-Null
$des = Rodar 'claude plugin uninstall usage-band-mod@usage-band-mod' { claude plugin uninstall usage-band-mod@usage-band-mod }
if ($des -notmatch 'Successfully uninstalled') { throw 'uninstall falhou' }
Rodar 'claude plugin marketplace remove usage-band-mod' { claude plugin marketplace remove usage-band-mod } | Out-Null
Rodar 'claude plugin list' { claude plugin list } | Out-Null
Anotar "> cópia em cache depois de desinstalar: $(if (Test-Path $cache) { 'ainda existe' } else { 'removida' })"

# 2. Desta cópia (a versão com Windows), como pasta: o Claude Code lê o plugin direto dela. Confere
#    que o exe que o git trouxe para o Windows é o publicado e que ele abre de dentro do plugin.
$inst = Rodar 'claude plugin install usage-band-mod --marketplace <esta cópia>' { claude plugin install usage-band-mod --marketplace $raiz }
if ($inst -notmatch 'Successfully installed plugin: usage-band-mod@usage-band-mod') { throw 'a instalação desta cópia não deu certo' }
$lista = Rodar 'claude plugin list' { claude plugin list }
$versao = (Get-Content (Join-Path $raiz '.claude-plugin\plugin.json') -Raw | ConvertFrom-Json).version
if ($lista -notmatch ('Version: ' + [regex]::Escape($versao)) -or $lista -notmatch 'enabled') { throw "a versão $versao não aparece habilitada" }
$pastaPlugin = if ($lista -match 'Read from:\s*(.+)') { $Matches[1].Trim() } else { $null }
if (-not $pastaPlugin) { $pastaPlugin = (Get-ChildItem $cache -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName 'windows\PainelDeUso.exe') } | Select-Object -First 1).FullName }
$exe = Join-Path $pastaPlugin 'windows\PainelDeUso.exe'
Anotar "> exe do plugin: $exe"
if (-not (Test-Path $exe)) { throw "PainelDeUso.exe não está em $pastaPlugin" }
$hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
$publicado = ((Get-Content (Join-Path $raiz 'windows\PainelDeUso.sha256') -Raw) -split '\s+')[0]
Anotar "  sha256 $hash (publicado $publicado), $((Get-Item $exe).Length) bytes"
if ($hash -ne $publicado) { throw 'o exe do plugin não é o publicado' }
& (Join-Path $PSScriptRoot 'imprimir.ps1') -Exe $exe -Estado (Join-Path $PSScriptRoot 'amostra-en.json') -Saida out/instalado.png -Opcoes '--claro'
Anotar '  o exe abriu de dentro do plugin, desenhou a janela e saiu com 0 (out/instalado.png)'
$des = Rodar 'claude plugin uninstall usage-band-mod@usage-band-mod' { claude plugin uninstall usage-band-mod@usage-band-mod }
if ($des -notmatch 'Successfully uninstalled') { throw 'uninstall falhou' }
Anotar 'instalação: OK'
if ($Saida) {
  $destino = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida))
  $pasta = Split-Path $destino
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory $pasta | Out-Null }
  [IO.File]::WriteAllLines($destino, $registro, (New-Object Text.UTF8Encoding $false))
}
