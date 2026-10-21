# Funções comuns aos scripts que abrem a janela de verdade: abrir, esperar a janela, achar uma janela
# pelo título e falar com ela por UI Automation. Carregado com ". ./janela.ps1".
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int size);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  public static IntPtr PorTitulo(string titulo) {
    IntPtr achou = IntPtr.Zero;
    EnumWindows(delegate (IntPtr h, IntPtr p) {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      if (sb.ToString().Contains(titulo)) { achou = h; return false; }
      return true;
    }, IntPtr.Zero);
    return achou;
  }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  // A janela de topo que aparece num ponto da tela.
  public static IntPtr RaizEm(int x, int y) { var p = new POINT { X = x, Y = y }; var w = WindowFromPoint(p); return w == IntPtr.Zero ? w : GetAncestor(w, 2); }
  public static int Processo(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return (int)pid; }
  public static string Titulo(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  // O Windows só deixa trazer uma janela para a frente a quem acabou de receber entrada: um Alt
  // apertado e solto satisfaz essa regra, e então SetForegroundWindow funciona.
  public static bool Ativar(IntPtr h) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(h);
    return GetForegroundWindow() == h;
  }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, string l, uint flags, uint ms, out IntPtr r);
  // Avisa todas as janelas (e o DWM) que o tema mudou: WM_SETTINGCHANGE com "ImmersiveColorSet".
  public static void AvisarTema() { IntPtr r; SendMessageTimeout((IntPtr)0xffff, 0x1A, IntPtr.Zero, "ImmersiveColorSet", 2, 3000, out r); }
  // Retângulo visível da janela (sem as bordas invisíveis de redimensionar do Windows 10/11).
  public static RECT Visivel(IntPtr h) {
    RECT r;
    if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(h, out r);
    return r;
  }
}
"@
[void][Win]::SetProcessDPIAware()

function Esperar-Janela([Diagnostics.Process]$Processo, [int]$Segundos = 15) {
  $limite = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $limite) {
    $Processo.Refresh()
    if ($Processo.HasExited) { throw "o app saiu antes de abrir a janela (código $($Processo.ExitCode))" }
    if ($Processo.MainWindowHandle -ne [IntPtr]::Zero) { return $Processo.MainWindowHandle }
    Start-Sleep -Milliseconds 200
  }
  throw "a janela não apareceu em $Segundos s"
}

$script:Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

# A janela existe antes do conteúdo: espera o WPF montar a árvore (o botão Pronto aparecer nela).
function Esperar-Conteudo($Janela, [int]$Segundos = 20) {
  $A = [System.Windows.Automation.AutomationElement]
  $condicao = New-Object System.Windows.Automation.AndCondition @(
    (New-Object System.Windows.Automation.PropertyCondition $A::ControlTypeProperty, ([System.Windows.Automation.ControlType]::Button)),
    (New-Object System.Windows.Automation.PropertyCondition $A::FrameworkIdProperty, 'WPF'))
  $limite = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $limite) {
    if ($Janela.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condicao) -ne $null) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "o conteúdo da janela não apareceu em $Segundos s"
}

# Todos os elementos de UI Automation abaixo de um elemento, na ordem da árvore.
function Elementos($Raiz) {
  $lista = New-Object Collections.Generic.List[object]
  $pilha = New-Object Collections.Generic.Stack[object]
  $pilha.Push(@($Raiz, 0))
  while ($pilha.Count -gt 0) {
    $item = $pilha.Pop()
    $el = $item[0]; $nivel = $item[1]
    $lista.Add([pscustomobject]@{ El = $el; Nivel = $nivel })
    $filhos = New-Object Collections.Generic.List[object]
    $f = $script:Walker.GetFirstChild($el)
    while ($f -ne $null) { $filhos.Add($f); $f = $script:Walker.GetNextSibling($f) }
    # Parênteses no nível: sem eles, a vírgula vence o + e o nível nunca sobe.
    for ($i = $filhos.Count - 1; $i -ge 0; $i--) { $pilha.Push(@($filhos[$i], ($nivel + 1))) }
  }
  return $lista
}

function Tipo($El) { $El.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '' }

function Achar($Raiz, [string]$TipoControle, [string]$Nome = $null) {
  foreach ($x in (Elementos $Raiz)) {
    $c = $x.El.Current
    if ($c.FrameworkId -ne 'WPF') { continue }
    if ((Tipo $x.El) -ne $TipoControle) { continue }
    if ($Nome -and $c.Name -ne $Nome) { continue }
    return $x.El
  }
  throw "não achei $TipoControle '$Nome'"
}
