# Conversa de ponta a ponta com o app, como o mod faz: estado inline em argv (com as aspas que o Node
# põe no Windows), linhas JSON na saída padrão. Muda ajustes por UI Automation e pelo teclado
# (setas, Esc, Enter) e confere cada linha que o app escreve.
#   powershell -File windows/ci/protocolo.ps1 -Exe windows/PainelDeUso.exe -Saida out/protocolo.txt
param([Parameter(Mandatory)][string]$Exe, [string]$Saida)
# Trava: só roda no GitHub Actions, num runner descartável.
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'protocolo.ps1 só roda no GitHub Actions (GITHUB_ACTIONS=true): ele abre a janela e aperta teclas (setas, Esc, Enter) na janela que estiver na frente. Não rode no seu computador.'
}
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'janela.ps1')
Add-Type -AssemblyName System.Windows.Forms
$registro = New-Object Collections.Generic.List[string]
function Anotar([string]$t) { Write-Host $t; $registro.Add($t) }

$estado = '{"prefs":{"idioma":"pt","moeda":"BRL","mascote":"animado","limitePorModelo":true},"amostra":{"modelo":"Opus 5.5","usd":34.63,"contexto":56,"cincoHoras":25,"semana":4,"porModelo":[{"modelo":"Fable","pct":2}],"taxas":{}}}'

# As regras de aspas que o Node (libuv) usa no Windows e que o .NET desfaz: "..." com \" por dentro.
function Citar([string]$a) {
  if ($a -notmatch '[\s"]') { return $a }
  '"' + (($a -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Abrir {
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = (Resolve-Path $Exe).Path
  $psi.Arguments = '--estado ' + (Citar $estado)
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = [Diagnostics.Process]::Start($psi)
  $script:erros = $p.StandardError.ReadToEndAsync()
  return $p
}

function Linha($p, [string]$Esperada, [int]$Ms = 15000) {
  $t = $p.StandardOutput.ReadLineAsync()
  if (-not $t.Wait($Ms)) { throw "o app não escreveu nada em $Ms ms (esperava $Esperada)" }
  $l = $t.Result
  Anotar "  < $l"
  if ($l -ne $Esperada) { throw "linha inesperada: '$l' (esperava '$Esperada')" }
}

function Prefs([string]$idioma, [string]$limite) { '{"prefs":{"idioma":"' + $idioma + '","limitePorModelo":' + $limite + ',"mascote":"animado","moeda":"BRL"}}' }

function Terminar($p) {
  if (-not $p.WaitForExit(10000)) { $p.Kill(); throw 'o app não saiu depois do fim' }
  $p.WaitForExit()
  $resto = $p.StandardOutput.ReadToEnd()
  if ($resto -ne '') { throw "saída depois do fim: '$resto'" }
  Anotar "  código de saída: $($p.ExitCode); stderr: '$($script:erros.Result.Trim())'"
  if ($p.ExitCode -ne 0) { throw "o app saiu com $($p.ExitCode)" }
}

Anotar "1. estado inline em argv: $(Citar $estado)"
$p = Abrir
Linha $p '{"pronto":true}'
$h = Esperar-Janela $p
$janela = [System.Windows.Automation.AutomationElement]::FromHandle($h)
Esperar-Conteudo $janela
Anotar "  janela: '$($janela.Current.Name)'"
if ($janela.Current.Name -ne 'Painel de uso') { throw 'o idioma do estado (pt) não chegou à janela' }
$previa = ''
foreach ($x in (Elementos $janela)) { if ((Tipo $x.El) -eq 'Image' -and $x.El.Current.Name -like 'Prévia da banda:*') { $previa = $x.El.Current.Name } }
Anotar "  prévia: '$previa'"
if ($previa -ne 'Prévia da banda: Opus 5.5, R$ 187,00, Contexto 56%, 5h 25%, 7d 4%, Fable 2%') { throw 'a prévia não tem os números do estado' }

Anotar '2. UI Automation: escolher English'
$en = Achar $janela 'RadioButton' 'English'
$en.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select()
Linha $p (Prefs 'en' 'true')

Anotar '3. UI Automation: desligar o limite por modelo'
$cb = Achar $janela 'CheckBox'
$cb.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Toggle()
Linha $p (Prefs 'en' 'false')

Anotar '4. teclado: seta para a direita no segmentado de idioma'
[void][Win]::SetForegroundWindow($h)
$en.SetFocus()
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('{RIGHT}')
Linha $p (Prefs 'pt' 'false')

Anotar '5. teclado: Esc fecha'
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
Linha $p '{"fim":true}'
Terminar $p

Anotar '6. teclado: Enter aperta Pronto (botão padrão)'
$p = Abrir
Linha $p '{"pronto":true}'
$h = Esperar-Janela $p
[void][Win]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Linha $p '{"fim":true}'
Terminar $p

Anotar 'protocolo: OK'
if ($Saida) {
  $pasta = Split-Path ([IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida)))
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory $pasta | Out-Null }
  [IO.File]::WriteAllLines([IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida)), $registro, (New-Object Text.UTF8Encoding $false))
}
