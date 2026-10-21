# Compila a janela de ajustes (Windows 10 1903+ e 11) num PainelDeUso.exe único (AnyCPU, .NET Framework 4.8).
# Precisa do .NET SDK fixado em global.json (dotnet --version mostra qual está ativo nesta pasta).
# Roda no PowerShell 7 (pwsh) e no Windows PowerShell 5.1. Salvo em UTF-8 com BOM, para o 5.1 ler os acentos.
#
#   pwsh windows/build.ps1                                     compila e confere com o PainelDeUso.sha256
#   powershell -ExecutionPolicy Bypass -File windows\build.ps1  o mesmo, no Windows PowerShell 5.1
#   pwsh windows/build.ps1 -AtualizarHash                      grava o exe e o hash novos (só quem mantém)
param([switch]$AtualizarHash)
$ErrorActionPreference = 'Stop'
# Trabalha dentro de windows/ e devolve quem chamou à pasta onde estava, mesmo se der erro.
Push-Location $PSScriptRoot
try {
  $pedido = (Get-Content global.json -Raw | ConvertFrom-Json).sdk.version
  # Sem o SDK pedido, "dotnet --version" falha e lista os que existem: aqui basta dizer qual instalar.
  $ativo = $null
  if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    $saida = & dotnet --version 2>$null
    if ($LASTEXITCODE -eq 0) { $ativo = "$saida".Trim() }
  }
  if ($ativo -ne $pedido) {
    $motivo = if ($ativo) { "o ativo é o $ativo" } else { 'ele não está instalado' }
    [Console]::Error.WriteLine("erro: windows/global.json pede o .NET SDK $pedido, e $motivo. Instale exatamente essa versão: https://dotnet.microsoft.com/download/dotnet/8.0")
    exit 1
  }
  & dotnet build PainelDeUso.csproj -c Release -nologo -v quiet
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $compilado = 'bin/Release/net48/PainelDeUso.exe'
  Write-Host "ok: $compilado"
  # Impressão digital do que foi compilado. O PainelDeUso.exe publicado só é substituído quando bate
  # com o hash publicado (dá no mesmo), quando ainda não há hash, ou a pedido (-AtualizarHash): uma
  # conferência que falha não deixa na pasta um exe diferente do publicado.
  $hash = (Get-FileHash $compilado -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($AtualizarHash) {
    Copy-Item $compilado PainelDeUso.exe -Force
    [IO.File]::WriteAllText("$PSScriptRoot/PainelDeUso.sha256", "$hash  PainelDeUso.exe`n")
    Write-Host "PainelDeUso.exe e hash gravados em PainelDeUso.sha256"
  }
  if (-not (Test-Path PainelDeUso.sha256)) {
    Copy-Item $compilado PainelDeUso.exe -Force
    Write-Host "sem hash publicado ainda: $hash"
    exit 0
  }
  $publicado = ((Get-Content PainelDeUso.sha256 -Raw) -split '\s+')[0]
  if ($hash -eq $publicado) {
    Copy-Item $compilado PainelDeUso.exe -Force
    Write-Host "PainelDeUso.exe: OK"
  } else {
    Write-Host "PainelDeUso.exe: FAILED`n  publicado $publicado`n  compilado $hash ($compilado; o PainelDeUso.exe publicado ficou como estava)"
    exit 1
  }
}
finally {
  Pop-Location
}
