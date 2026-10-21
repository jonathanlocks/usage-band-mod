# Captura de tela de verdade (o que o DWM compôs: barra de título do sistema, Mica, sombra).
# Dois jeitos:
#   -Exe -Estado -Tema claro|escuro   muda o tema do Windows, abre o app e captura a janela dele
#   -Processo <id> | -Janela <título> captura uma janela já aberta (console da banda)
#   -SoPapel -Tema claro|escuro       só troca o papel de parede e minimiza as janelas (antes do console)
# Com -AltoContraste, liga o alto contraste do Windows antes de abrir o app e desliga depois.
# Com -Teclas, põe o foco no primeiro controle e aperta essas teclas (formato do SendKeys, ex.
# '{RIGHT}{LEFT}') antes de capturar: o anel de foco do teclado aparece na imagem.
# Com -Papel, antes troca o papel de parede por um gradiente colorido (o do --print) e minimiza as
# outras janelas: com a Mica, a janela pegaria a cor do papel de parede. Nos runners ela não apareceu.
# -Margem: pixels em volta da janela (8 por padrão, para a sombra; 0 recorta rente à janela).
# Avisa (::warning::) quando a imagem parece preta ou uniforme: a captura falhou.
param(
  [string]$Exe,
  [string]$Estado,
  [ValidateSet('claro', 'escuro')][string]$Tema = 'claro',
  [int]$Processo = 0,
  [string]$Janela,
  [switch]$Papel,
  [switch]$SoPapel,
  [int]$Margem = 8,
  [string]$Teclas,
  [switch]$AltoContraste,
  [string]$Saida
)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'captura-tela.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele muda o tema, o papel de parede, a transparência e o alto contraste do Windows, minimiza janelas, aperta teclas e pode encerrar o processo da janela que estiver na frente. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'janela.ps1')
Add-Type -AssemblyName System.Drawing

$chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
function Ler-Tema { if (Test-Path $chave) { Get-ItemProperty $chave -ErrorAction SilentlyContinue } }
function Gravar-Tema([int]$claro) {
  if (-not (Test-Path $chave)) { New-Item -Path $chave -Force | Out-Null }
  Set-ItemProperty $chave -Name AppsUseLightTheme -Value $claro -Type DWord
  Set-ItemProperty $chave -Name SystemUsesLightTheme -Value $claro -Type DWord
  # Efeitos de transparência ligados: desligados (o padrão dos runners), a Mica vira a cor sólida.
  Set-ItemProperty $chave -Name EnableTransparency -Value 1 -Type DWord
  [Win]::AvisarTema()
}

# Uma janela do sistema na frente da nossa (no runner windows-11-arm, a tela de privacidade da primeira
# entrada fica por cima de tudo): minimiza; se não sair, encerra o processo dela. Só em runner de CI.
function Liberar-Frente([IntPtr]$h) {
  for ($tentativa = 0; $tentativa -lt 3; $tentativa++) {
    $r = [Win]::Visivel($h)
    $frente = [Win]::RaizEm([int](($r.Left + $r.Right) / 2), [int](($r.Top + $r.Bottom) / 2))
    if ($frente -eq [IntPtr]::Zero -or $frente -eq $h) { return }
    $pidFrente = [Win]::Processo($frente)
    $nome = (Get-Process -Id $pidFrente -ErrorAction SilentlyContinue).ProcessName
    if ($tentativa -eq 0) {
      Write-Host "janela na frente: '$([Win]::Titulo($frente))' (processo $nome, $pidFrente): minimizando"
      [void][Win]::ShowWindow($frente, 6)
    } elseif ($nome -and $nome -notin 'explorer', 'PainelDeUso', 'WindowsTerminal', 'conhost', 'powershell', 'pwsh') {
      Write-Host "ainda na frente: encerrando $nome ($pidFrente)"
      Stop-Process -Id $pidFrente -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
    [void][Win]::SetForegroundWindow($h)
    Start-Sleep -Seconds 1
  }
}

function Capturar([IntPtr]$h, [string]$destino, [int]$tentativa = 1) {
  [void][Win]::ShowWindow($h, 9)
  [void][Win]::SetForegroundWindow($h)
  Start-Sleep -Seconds 2
  Liberar-Frente $h
  # A Mica só aparece na janela ativa; inativa, o Windows pinta a cor sólida.
  $ativa = [Win]::Ativar($h)
  Start-Sleep -Seconds 1
  Write-Host "janela ativa: $ativa"
  if ($Teclas -and $tentativa -eq 1) {
    Add-Type -AssemblyName System.Windows.Forms
    # Primeiro o foco no primeiro controle (por UI Automation); as teclas fazem o resto.
    (Achar ([System.Windows.Automation.AutomationElement]::FromHandle($h)) 'RadioButton').SetFocus()
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait($Teclas)
    Start-Sleep -Milliseconds 700
    Write-Host "teclas: $Teclas"
  }
  $r = [Win]::Visivel($h)
  $m = $Margem
  $x = [Math]::Max(0, $r.Left - $m); $y = [Math]::Max(0, $r.Top - $m)
  $w = ($r.Right + $m) - $x; $hgt = ($r.Bottom + $m) - $y
  $bmp = New-Object Drawing.Bitmap $w, $hgt
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, (New-Object Drawing.Size $w, $hgt))
  $g.Dispose()
  $pasta = Split-Path $destino
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory $pasta | Out-Null }
  $bmp.Save($destino, [Drawing.Imaging.ImageFormat]::Png)
  # Desvio padrão do brilho em 500 pontos: perto de 0, a imagem é uma cor só.
  $rnd = New-Object Random 7
  $v = for ($i = 0; $i -lt 500; $i++) { $c = $bmp.GetPixel($rnd.Next($w), $rnd.Next($hgt)); 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B }
  $media = ($v | Measure-Object -Average).Average
  $desvio = [Math]::Sqrt((($v | ForEach-Object { ($_ - $media) * ($_ - $media) }) | Measure-Object -Average).Average)
  $bmp.Dispose()
  Write-Host ("captura {0}: {1}x{2} em ({3},{4}), brilho médio {5:N1}, desvio {6:N1}" -f $destino, $w, $hgt, $x, $y, $media, $desvio)
  if ($desvio -lt 2) {
    # Logo depois de minimizar uma janela da frente a tela pode vir preta: mais uma tentativa.
    if ($tentativa -lt 2) { Start-Sleep -Seconds 2; Capturar $h $destino ($tentativa + 1); return }
    Write-Host "::warning::captura possivelmente preta ou uniforme: $destino"
  }
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Papel {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SystemParametersInfo(int acao, int p, string v, int f);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct HIGHCONTRAST { public int cbSize; public int dwFlags; public string lpszDefaultScheme; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SystemParametersInfoW")]
  static extern bool SpiContraste(int acao, int p, ref HIGHCONTRAST v, int f);
  // SPI_SETHIGHCONTRAST com HCF_HIGHCONTRASTON ligado ou desligado.
  public static bool Contraste(bool ligar) {
    var hc = new HIGHCONTRAST { cbSize = Marshal.SizeOf(typeof(HIGHCONTRAST)), dwFlags = ligar ? 1 : 0, lpszDefaultScheme = ligar ? "High Contrast Black" : null };
    return SpiContraste(0x43, hc.cbSize, ref hc, 3);
  }
}
"@
function Trocar-Papel([bool]$escuro) {
  $w = 1024; $h = 768
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $cores = if ($escuro) { @(@(26, 31, 56), @(92, 43, 64), @(204, 107, 74)) } else { @(@(158, 199, 242), @(237, 204, 219), @(252, 219, 179)) }
  $pincel = New-Object Drawing.Drawing2D.LinearGradientBrush (New-Object Drawing.Point 0, 0), (New-Object Drawing.Point $w, $h), ([Drawing.Color]::Black), ([Drawing.Color]::White)
  $mistura = New-Object Drawing.Drawing2D.ColorBlend 3
  $mistura.Colors = @($cores | ForEach-Object { [Drawing.Color]::FromArgb($_[0], $_[1], $_[2]) })
  $mistura.Positions = @(0.0, 0.55, 1.0)
  $pincel.InterpolationColors = $mistura
  $g.FillRectangle($pincel, 0, 0, $w, $h)
  $g.Dispose()
  $arquivo = Join-Path $env:TEMP 'papel-usage-band.bmp'
  $bmp.Save($arquivo, [Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
  # SPI_SETDESKWALLPAPER, gravando no perfil e avisando as janelas.
  [void][Papel]::SystemParametersInfo(0x14, 0, $arquivo, 3)
  (New-Object -ComObject Shell.Application).MinimizeAll()
  Start-Sleep -Seconds 2
}

if ($SoPapel) { Trocar-Papel ($Tema -eq 'escuro'); exit 0 }
if (-not $Saida) { throw 'falta -Saida' }
$destino = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida))
if ($Exe) {
  $antes = Ler-Tema
  Gravar-Tema $(if ($Tema -eq 'claro') { 1 } else { 0 })
  if ($Papel) { Trocar-Papel ($Tema -eq 'escuro') }
  if ($AltoContraste) { Write-Host "alto contraste ligado: $([Papel]::Contraste($true))"; Start-Sleep -Seconds 3 }
  try {
    $p = Start-Process -FilePath (Resolve-Path $Exe).Path -ArgumentList '--estado', ('"@' + (Resolve-Path $Estado).Path + '"') -PassThru
    try {
      $h = Esperar-Janela $p
      Esperar-Conteudo ([System.Windows.Automation.AutomationElement]::FromHandle($h))
      Capturar $h $destino
    }
    finally { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force } }
  }
  finally {
    if ($AltoContraste) { Write-Host "alto contraste desligado: $([Papel]::Contraste($false))"; Start-Sleep -Seconds 2 }
    if ($antes -and $null -ne $antes.AppsUseLightTheme) { Gravar-Tema $antes.AppsUseLightTheme } else { Gravar-Tema 1 }
  }
}
else {
  $h = [IntPtr]::Zero
  $limite = (Get-Date).AddSeconds(15)
  while ($h -eq [IntPtr]::Zero -and (Get-Date) -lt $limite) {
    if ($Processo -ne 0) { $pr = Get-Process -Id $Processo -ErrorAction SilentlyContinue; if ($pr) { $h = $pr.MainWindowHandle } }
    if ($h -eq [IntPtr]::Zero -and $Janela) { $h = [Win]::PorTitulo($Janela) }
    if ($h -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 300 }
  }
  if ($h -eq [IntPtr]::Zero) { throw "janela não encontrada (processo $Processo, título '$Janela')" }
  Capturar $h $destino
}
