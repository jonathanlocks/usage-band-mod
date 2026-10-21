// Chamadas ao Windows que o WPF não tem: barra de título escura e Mica (dwmapi), e trazer a janela
// para a frente (user32). Nenhuma lança: um HRESULT diferente de 0 vira "não deu", e a janela segue
// com o fundo sólido.
using System;
using System.Runtime.InteropServices;

namespace PainelDeUso
{
    public static class Nativo
    {
        public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        public const int DWMWA_USE_IMMERSIVE_DARK_MODE_ANTIGO = 19;
        public const int DWMWA_SYSTEMBACKDROP_TYPE = 38;
        public const int DWMSBT_NONE = 1;
        public const int DWMSBT_MAINWINDOW = 2;
        public const int DWMWA_MICA_EFFECT = 1029;

        [StructLayout(LayoutKind.Sequential)]
        private struct MARGINS
        {
            public int Esquerda, Direita, Topo, Base;
        }

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int atributo, ref int valor, int tamanho);

        [DllImport("dwmapi.dll")]
        private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref MARGINS margens);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetForegroundWindow(IntPtr hwnd);

        private static int Atributo(IntPtr hwnd, int atributo, int valor)
        {
            try
            {
                return DwmSetWindowAttribute(hwnd, atributo, ref valor, sizeof(int));
            }
            catch (Exception e) when (e is DllNotFoundException || e is EntryPointNotFoundException)
            {
                return -1;
            }
        }

        // Barra de título clara ou escura. Devolve o HRESULT (0 = ok).
        public static int AplicarEscuro(IntPtr hwnd, bool escuro) => Atributo(hwnd, Tema.ModoEscuroAttr, escuro ? 1 : 0);

        // Mica no fundo inteiro da janela. Devolve se o DWM aceitou; hr fica com o HRESULT da última chamada.
        public static bool AplicarMica(IntPtr hwnd, out int hr)
        {
            try
            {
                var m = new MARGINS { Esquerda = -1, Direita = -1, Topo = -1, Base = -1 };
                hr = DwmExtendFrameIntoClientArea(hwnd, ref m);
                if (hr != 0) return false;
            }
            catch (Exception e) when (e is DllNotFoundException || e is EntryPointNotFoundException)
            {
                hr = -1;
                return false;
            }
            // 22H2 (22621) em diante: o tipo de fundo do sistema. 21H2: o atributo antigo, não documentado.
            hr = Tema.Build >= 22621
                ? Atributo(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_MAINWINDOW)
                : Atributo(hwnd, DWMWA_MICA_EFFECT, 1);
            return hr == 0;
        }

        // Desliga a Mica (alto contraste ligado com a janela aberta).
        public static void TirarMica(IntPtr hwnd)
        {
            if (Tema.Build >= 22621) Atributo(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_NONE);
            else Atributo(hwnd, DWMWA_MICA_EFFECT, 0);
            try
            {
                var m = new MARGINS();
                DwmExtendFrameIntoClientArea(hwnd, ref m);
            }
            catch (Exception e) when (e is DllNotFoundException || e is EntryPointNotFoundException)
            {
            }
        }
    }
}
