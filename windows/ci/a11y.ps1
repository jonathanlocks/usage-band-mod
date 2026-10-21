# Varredura de acessibilidade: abre a janela, percorre a árvore de UI Automation (a que o Narrador lê)
# e grava uma linha por elemento. Falha se um controle não tiver nome, se a janela ou a prévia não
# tiverem nome, ou se não houver exatamente 8 botões de opção, 1 caixa de seleção e 1 botão.
# Só conta os elementos do WPF: a barra de título (do sistema) tem seu próprio botão Fechar.
#   powershell -File windows/ci/a11y.ps1 -Exe windows/PainelDeUso.exe -Estado windows/ci/amostra-en.json -Saida out/a11y-en.txt
param([Parameter(Mandatory)][string]$Exe, [Parameter(Mandatory)][string]$Estado, [Parameter(Mandatory)][string]$Saida)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'a11y.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele abre a janela e a encerra à força no fim. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'janela.ps1')
$p = Start-Process -FilePath (Resolve-Path $Exe).Path -ArgumentList '--estado', ('"@' + (Resolve-Path $Estado).Path + '"') -PassThru
try {
  $h = Esperar-Janela $p
  $janela = [System.Windows.Automation.AutomationElement]::FromHandle($h)
  Esperar-Conteudo $janela
  $linhas = New-Object Collections.Generic.List[string]
  $falhas = New-Object Collections.Generic.List[string]
  $conta = @{}
  $linhas.Add("janela: '$($janela.Current.Name)'")
  if ([string]::IsNullOrWhiteSpace($janela.Current.Name)) { $falhas.Add('a janela não tem nome') }
  $previa = $false
  foreach ($x in (Elementos $janela)) {
    if ($x.Nivel -eq 0) { continue }
    $el = $x.El; $c = $el.Current; $tipo = Tipo $el
    $estadoTxt = ''
    try { $estadoTxt = ' selecionado=' + $el.GetCurrentPropertyValue([System.Windows.Automation.SelectionItemPattern]::IsSelectedProperty) } catch {}
    if ($tipo -eq 'CheckBox') { $estadoTxt = ' estado=' + $el.GetCurrentPropertyValue([System.Windows.Automation.TogglePattern]::ToggleStateProperty) }
    if ($tipo -ne 'RadioButton' -and $tipo -ne 'CheckBox') { $estadoTxt = '' }
    $linhas.Add(('{0}{1} [{2}] nome="{3}" ajuda="{4}" teclado={5}{6}' -f ('  ' * $x.Nivel), $tipo, $c.FrameworkId, $c.Name, $c.HelpText, $c.IsKeyboardFocusable, $estadoTxt))
    if ($c.FrameworkId -ne 'WPF') { continue }
    if ($tipo -in 'RadioButton', 'CheckBox', 'Button', 'Group') {
      $conta[$tipo] = 1 + [int]$conta[$tipo]
      if ([string]::IsNullOrWhiteSpace($c.Name)) { $falhas.Add("$tipo sem nome") }
      if ($tipo -ne 'Group' -and -not $c.IsKeyboardFocusable) { $falhas.Add("$tipo '$($c.Name)' não recebe foco do teclado") }
    }
    if ($tipo -eq 'Image' -and ($c.Name -like 'Preview of the band: *' -or $c.Name -like 'Prévia da banda: *')) { $previa = $true }
  }
  foreach ($par in @(@('RadioButton', 8), @('CheckBox', 1), @('Button', 1), @('Group', 3))) {
    if ([int]$conta[$par[0]] -ne $par[1]) { $falhas.Add("esperava $($par[1]) $($par[0]), achei $([int]$conta[$par[0]])") }
  }
  if (-not $previa) { $falhas.Add('a prévia não tem nome descritivo') }
  $linhas.Add('')
  $linhas.Add("contagem (WPF): RadioButton=$([int]$conta['RadioButton']) CheckBox=$([int]$conta['CheckBox']) Button=$([int]$conta['Button']) Group=$([int]$conta['Group'])")
  $linhas.Add($(if ($falhas.Count -eq 0) { 'resultado: OK' } else { 'resultado: FALHOU: ' + ($falhas -join '; ') }))
  $destino = [IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida))
  $pasta = Split-Path $destino
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory $pasta | Out-Null }
  [IO.File]::WriteAllLines($destino, $linhas, (New-Object Text.UTF8Encoding $false))
  $linhas | ForEach-Object { Write-Host $_ }
  if ($falhas.Count -gt 0) { throw ('acessibilidade: ' + ($falhas -join '; ')) }
}
finally {
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
}
