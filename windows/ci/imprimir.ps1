# Roda o app com --print e confere tudo o que dá para conferir sem olhar: código de saída 0, o
# protocolo na saída padrão ({"pronto":true} primeiro, {"fim":true} por último, nada além disso) e
# um PNG de verdade. O diagnóstico do app (build, fontes, HRESULT da Mica) vai para o log.
#   ./imprimir.ps1 -Exe windows/PainelDeUso.exe -Estado windows/ci/amostra-en.json -Saida out/x.png -Opcoes --escuro,--win10
param(
  [Parameter(Mandatory)][string]$Exe,
  [Parameter(Mandatory)][string]$Estado,
  [Parameter(Mandatory)][string]$Saida,
  [string[]]$Opcoes = @()
)
$ErrorActionPreference = 'Stop'
$destino = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida))
$pasta = Split-Path $destino
if (-not (Test-Path $pasta)) { New-Item -ItemType Directory $pasta | Out-Null }
if (Test-Path $destino) { Remove-Item $destino }
$psi = New-Object Diagnostics.ProcessStartInfo
$psi.FileName = (Resolve-Path $Exe).Path
$psi.Arguments = (@('--estado', ('"@' + (Resolve-Path $Estado).Path + '"'), '--print', ('"' + $destino + '"')) + $Opcoes) -join ' '
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$p = [Diagnostics.Process]::Start($psi)
$out = $p.StandardOutput.ReadToEndAsync()
$err = $p.StandardError.ReadToEndAsync()
if (-not $p.WaitForExit(60000)) { $p.Kill(); throw "o app não terminou em 60 s: $Saida" }
$p.WaitForExit()
$linhas = @($out.Result -split "`n" | Where-Object { $_ -ne '' })
Write-Host "print $Saida $($Opcoes -join ' ') -> saída $($p.ExitCode)"
Write-Host "  stdout: $($linhas -join ' | ')"
Write-Host "  stderr: $($err.Result.Trim())"
if ($out.Result.Contains("`r")) { throw "a saída padrão tem \r: as linhas devem terminar só em \n" }
if ($p.ExitCode -ne 0) { throw "o app saiu com $($p.ExitCode)" }
if ($linhas.Count -ne 2 -or $linhas[0] -ne '{"pronto":true}' -or $linhas[1] -ne '{"fim":true}') { throw "protocolo inesperado: $($linhas -join ' | ')" }
if (-not (Test-Path $destino) -or (Get-Item $destino).Length -lt 10000) { throw "PNG ausente ou pequeno demais: $destino" }
Add-Type -AssemblyName System.Drawing
$img = [Drawing.Image]::FromFile($destino)
Write-Host "  png: $($img.Width)x$($img.Height), $((Get-Item $destino).Length) bytes"
$img.Dispose()
