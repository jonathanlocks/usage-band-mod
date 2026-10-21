# Teste de glifos para a captura de tela do CI: imprime os caracteres e as cores que a banda usa
# (o mascote ╺▮ ▮╸ com fundo laranja, barras de fundo pintado, ·, ↻, ×), com uma linha de título que diz o que é. Não é uma sessão do Claude Code nem
# a banda rodando: o texto é fixo, só para ver se o console desenha esses caracteres.
# Funciona no Windows PowerShell 5.1 (conhost) e no PowerShell 7 (Windows Terminal). Salvo em
# UTF-8 com BOM: sem ele, o 5.1 lê os blocos como texto ANSI.
$Host.UI.RawUI.WindowTitle = 'banda'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
# Sequências de cor (VT): o PowerShell 7 já liga; no 5.1 é preciso pedir ao console.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class Vt {
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr h, out int m);
  [DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr h, int m);
  public static void Ligar() { var h = GetStdHandle(-11); int m; if (GetConsoleMode(h, out m)) SetConsoleMode(h, m | 4); }
}
"@
[Vt]::Ligar()
try {
  $tam = $Host.UI.RawUI.WindowSize
  if ($tam.Width -lt 124) {
    $Host.UI.RawUI.BufferSize = New-Object Management.Automation.Host.Size 124, 300
    $Host.UI.RawUI.WindowSize = New-Object Management.Automation.Host.Size 124, 10
  }
} catch {}
$e = [char]27
function Cor($r, $g, $b) { "$e[38;2;${r};${g};${b}m" }
function Fundo($r, $g, $b) { "$e[48;2;${r};${g};${b}m" }
$laranja = Cor 215 119 87; $verde = Cor 78 186 101; $cinza = Cor 153 153 153; $claro = Cor 230 230 230; $preto = Cor 0 0 0
$fLaranja = Fundo 215 119 87; $fVerde = Fundo 78 186 101; $fTrilho = Fundo 80 80 80
$negrito = "$e[1m"; $fim = "$e[0m"
$mascote = "${laranja}╺$fim${fLaranja}${preto}▮$fim${fLaranja} $fim${fLaranja}${preto}▮$fim${laranja}╸$fim"
function Barra($cheio, $vazio) { "${fVerde}" + (' ' * $cheio) + "$fim${fTrilho}" + (' ' * $vazio) + $fim }
$banda = " $mascote ${claro}${negrito}Opus 5.5$fim${cinza} · `$34.63   Context $(Barra 3 3)${verde} 56%${cinza} 112k/200k    5h $(Barra 1 5)${verde} 25%${cinza} ↻ 2h 10m     7d ${cinza}······${verde}${cinza} —      Fable $(Barra 1 5)${verde} 2%   ${cinza}×$fim"
$olhos = "${cinza}Eye candidates on orange: $fim${fLaranja}${preto} ▮ $fim ${fLaranja}${preto} ▪ $fim ${fLaranja}${preto} ■ $fim${cinza}   arm candidates: ${laranja}╺ ╸  ▗ ▖  ▝ ▘  ━$fim"
$linhas = @(
  "${claro}Glyph check: the characters and colors the usage band uses, printed by a script.$fim",
  "${cinza}Not a Claude Code session; fixed sample text.$fim",
  '',
  $banda,
  '',
  $olhos
)
Clear-Host
foreach ($l in $linhas) { [Console]::WriteLine($l) }
# Fica aberto, sem prompt nem cursor piscando, até o workflow fechar a janela.
try { [Console]::CursorVisible = $false } catch {}
Start-Sleep -Seconds 600
