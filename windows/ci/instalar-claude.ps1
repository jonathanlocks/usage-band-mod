# Instala o Claude Code nativo no runner do Windows (o mesmo instalador da documentação) e o põe no
# PATH dos próximos passos do workflow. Sempre a versão mais nova: o CI quer saber se o mod quebrou nela.
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'instalar-claude.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele instala o Claude Code e mexe no PATH do workflow. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
$instalador = Invoke-RestMethod https://claude.ai/install.ps1
& ([scriptblock]::Create($instalador))
$bin = Join-Path $env:USERPROFILE '.local\bin'
if ($env:GITHUB_PATH) { Add-Content -Path $env:GITHUB_PATH -Value $bin }
& (Join-Path $bin 'claude.exe') --version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
