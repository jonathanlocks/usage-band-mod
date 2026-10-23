# A janela de ajustes abre na frente do app que a pediu. No app do Claude, quem abre o exe é um processo
# de fundo (app → claude.exe → worker → exe), e o Windows nega o primeiro plano a ele: a janela nascia
# atrás. Aqui uma janela no papel do Claude fica na frente e recebe uma tecla, e o exe é aberto por outro
# processo (este script), que não recebeu nem injetou entrada nenhuma. Passa se a janela de ajustes ficar por cima da outra; diz também se ganhou o foco.
#   powershell -File windows/ci/frente.ps1 -Exe windows/PainelDeUso.exe          falha se ficar atrás
param([Parameter(Mandatory)][string]$Exe)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'frente.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele abre janelas, aperta F15 e muda a trava de primeiro plano do Windows. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'janela.ps1')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Ordem {
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  // a está acima de b na ordem da tela? Desce de a (GW_HWNDNEXT) até achar b.
  public static bool Acima(IntPtr a, IntPtr b) {
    for (var w = GetWindow(a, 2); w != IntPtr.Zero; w = GetWindow(w, 2)) if (w == b) return true;
    return false;
  }
  [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint acao, uint p1, ref uint p2, uint f);
  [DllImport("user32.dll", EntryPoint = "SystemParametersInfo")] static extern bool SpiSet(uint acao, uint p1, UIntPtr p2, uint f);
  // A trava de primeiro plano (ms sem entrada até qualquer um poder tomar a frente). Num PC é 200000.
  public static uint Trava() { uint v = 0; SystemParametersInfo(0x2000, 0, ref v, 0); return v; }
  public static bool Travar(uint ms) { return SpiSet(0x2001, 0, (UIntPtr)ms, 0); }
}
"@

# Os runners vêm com a trava desligada (0): com ela, o Windows deixa qualquer um tomar a frente e o
# problema não aparece. Liga como num PC (200000 ms), enquanto este script ainda pode mexer nela.
$antes = [Ordem]::Trava()
$ligou = [Ordem]::Travar(200000)
Write-Host "trava de primeiro plano: $antes ms -> $([Ordem]::Trava()) ms (ok=$ligou)"

# O "Claude": uma janela grande, noutro processo, que se põe na frente ao aparecer. Sem -WindowStyle
# Hidden: o Windows aplicaria o "escondido" à primeira janela que o processo mostra, o formulário.
$form = 'Add-Type -AssemblyName System.Windows.Forms; $f = New-Object Windows.Forms.Form; $f.Text = "Claude (papel)"; $f.Width = 1200; $f.Height = 760; $f.StartPosition = "CenterScreen"; $f.Add_Shown({ $f.Activate(); [Windows.Forms.SendKeys]::SendWait("{F15}") }); [Windows.Forms.Application]::Run($f)'
$codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($form))
$claude = Start-Process powershell -ArgumentList '-NoProfile', '-EncodedCommand', $codificado -PassThru
$painel = $null
try {
  $hClaude = [IntPtr]::Zero
  for ($i = 0; $i -lt 75 -and $hClaude -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 200; $hClaude = [Win]::PorTitulo('Claude (papel)') }
  if ($hClaude -eq [IntPtr]::Zero) { throw 'a janela no papel do Claude não apareceu' }
  # A entrada (um F15 que ninguém usa) sai do próprio "Claude", como o clique da pessoa no ⚙. Este script
  # não aperta nada: quem injeta entrada ganha o direito de tomar a frente e o passa ao exe que abrir.
  Start-Sleep -Milliseconds 1500
  Write-Host "na frente antes de abrir: '$([Win]::Titulo([Win]::GetForegroundWindow()))'"

  $estado = '{"prefs":{"idioma":"pt","moeda":"BRL","mascote":"parado","limitePorModelo":true},"amostra":{}}'
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = (Resolve-Path $Exe).Path
  $psi.Arguments = '--estado "' + ($estado -replace '"', '\"') + '"'
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $painel = [Diagnostics.Process]::Start($psi)
  $hPainel = Esperar-Janela $painel
  $pronto = $painel.StandardOutput.ReadLineAsync()
  if (-not $pronto.Wait(15000)) { throw 'o app não disse pronto em 15 s' }
  Start-Sleep -Milliseconds 800

  $acima = [Ordem]::Acima($hPainel, $hClaude)
  $foco = [Win]::GetForegroundWindow() -eq $hPainel
  Write-Host "$(Split-Path $Exe -Leaf): por cima do Claude=$acima, com o foco=$foco, na frente: '$([Win]::Titulo([Win]::GetForegroundWindow()))'"
  if (-not $acima) { throw 'a janela de ajustes abriu atrás da janela do Claude' }
} finally {
  if ($painel -ne $null -and -not $painel.HasExited) { $painel.Kill() }
  if (-not $claude.HasExited) { $claude.Kill() }
}
