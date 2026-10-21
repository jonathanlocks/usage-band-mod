# Teste de glifos para a captura de tela do CI: imprime os caracteres e as cores que a banda usa
# (▐▛███▜▌, █, ░, ↻), com uma linha de título que diz o que é. Não é uma sessão do Claude Code nem
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
$laranja = Cor 217 119 87; $verde = Cor 78 186 101; $cinza = Cor 124 124 124; $claro = Cor 230 230 230
$negrito = "$e[1m"; $fim = "$e[0m"
$banda = " ${laranja}▐▛███▜▌ ${claro}${negrito}Opus 5.5$fim${cinza} · `$34.63  Context ${verde}█████${cinza}░░░░${verde}  56%${cinza}  5h ${verde}██${cinza}░░░░░░${verde}  25%${cinza} ↻ 2h 10m  7d ░░░░░░░░${verde}   4%${cinza}  Fable ░░░░░░░░${verde}   2% ${cinza}×$fim"
$linhas = @(
  "${claro}Glyph check: the characters and colors the usage band uses, printed by a script.$fim",
  "${cinza}Not a Claude Code session; fixed sample text.$fim",
  '',
  $banda
)
Clear-Host
foreach ($l in $linhas) { [Console]::WriteLine($l) }
# Fica aberto, sem prompt nem cursor piscando, até o workflow fechar a janela.
try { [Console]::CursorVisible = $false } catch {}
Start-Sleep -Seconds 600
