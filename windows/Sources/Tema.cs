// Tema da janela: claro ou escuro (o do sistema, ou forçado por --claro/--escuro), alto contraste,
// movimento reduzido e a versão do Windows (que decide se há Mica). As cores são recursos dinâmicos
// do Application: ao mudar o tema do sistema, Reaplicar() troca os pincéis e a janela se redesenha.
using System;
using System.Linq;
using System.Windows;
using System.Windows.Media;
using Microsoft.Win32;

namespace PainelDeUso
{
    public static class Tema
    {
        private static bool? escuroForcado;

        public static bool Escuro { get; private set; }
        public static bool AltoContraste { get; private set; }
        public static bool MovimentoReduzido { get; private set; }
        public static bool SemMica { get; private set; }
        public static int Build { get; private set; }
        // Ligado pela janela quando o DWM aceitou a Mica: os cartões ficam translúcidos sobre ela.
        public static bool UsandoMica { get; set; }

        // Mica existe a partir do Windows 11 (22000); em alto contraste o fundo é a cor do sistema.
        public static bool MicaPossivel => Build >= 22000 && !AltoContraste && !SemMica;

        // O atributo da barra de título escura mudou de número no build 18985 (Windows 10 20H1).
        public static int ModoEscuroAttr => Build >= 18985 ? Nativo.DWMWA_USE_IMMERSIVE_DARK_MODE : Nativo.DWMWA_USE_IMMERSIVE_DARK_MODE_ANTIGO;

        // Texto em Segoe UI, nos dois sistemas. A Segoe UI Variable do Windows 11 é uma fonte variável, e o
        // WPF do .NET Framework não trata eixos de fontes variáveis: os pesos (SemiBold) não ficariam
        // garantidos. A Segoe UI tem cada peso num arquivo próprio e desenha igual no 10 e no 11.
        // Os ícones: Segoe Fluent Icons no 11, MDL2 no 10 (os mesmos códigos nas duas fontes).
        public static readonly FontFamily FonteTexto = new FontFamily("Segoe UI");
        public static readonly FontFamily FonteIcones = new FontFamily("Segoe Fluent Icons, Segoe MDL2 Assets");

        public const string Engrenagem = "";
        public const string Fechar = "";

        public static void Iniciar(bool? escuro, bool semMica)
        {
            escuroForcado = escuro;
            SemMica = semMica;
            Build = LerBuild();
            Reaplicar();
        }

        public static void Reaplicar()
        {
            Escuro = escuroForcado ?? LerEscuro();
            AltoContraste = SystemParameters.HighContrast;
            MovimentoReduzido = !SystemParameters.ClientAreaAnimation;
            Aplicar(Application.Current.Resources);
        }

        // O sistema e as fontes Segoe que o WPF enxerga, para o diagnóstico do --print.
        public static string Diagnostico()
        {
            var segoe = Fonts.SystemFontFamilies.Select(f => f.Source).Where(n => n.StartsWith("Segoe", StringComparison.OrdinalIgnoreCase)).OrderBy(n => n, StringComparer.Ordinal);
            return $"build={Build} escuro={Escuro} altoContraste={AltoContraste} movimentoReduzido={MovimentoReduzido} fontes=[{string.Join(", ", segoe)}]";
        }

        private static bool LerEscuro()
        {
            try
            {
                using var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
                return k?.GetValue("AppsUseLightTheme") is int v && v == 0;
            }
            catch (Exception)
            {
                return false;
            }
        }

        private static int LerBuild()
        {
            try
            {
                using var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                if (k?.GetValue("CurrentBuild") is string s && int.TryParse(s, out var b)) return b;
            }
            catch (Exception)
            {
            }
            return Environment.OSVersion.Version.Build;
        }

        private static SolidColorBrush Pincel(uint argb)
        {
            var b = new SolidColorBrush(Color.FromArgb((byte)(argb >> 24), (byte)(argb >> 16), (byte)(argb >> 8), (byte)argb));
            b.Freeze();
            return b;
        }

        // Cor com transparência em porcentagem (0–100) sobre um RGB.
        private static SolidColorBrush Pincel(uint rgb, double opacidade) => Pincel(((uint)Math.Round(opacidade * 255 / 100) << 24) | (rgb & 0xFFFFFF));

        private static void Aplicar(ResourceDictionary r)
        {
            r["FonteTexto"] = FonteTexto;
            r["FonteIcones"] = FonteIcones;
            if (AltoContraste)
            {
                // Alto contraste: só as cores do sistema, bordas de 1 px, e a cor deixa de carregar informação.
                r["CorJanela"] = SystemColors.WindowBrush;
                r["CorCartao"] = SystemColors.WindowBrush;
                r["CorBordaCartao"] = SystemColors.WindowTextBrush;
                r["CorPrevia"] = SystemColors.WindowBrush;
                r["CorTexto"] = SystemColors.WindowTextBrush;
                r["CorSecundaria"] = SystemColors.WindowTextBrush;
                r["CorDivisor"] = SystemColors.WindowTextBrush;
                r["CorSegmentos"] = SystemColors.WindowBrush;
                r["CorHover"] = SystemColors.WindowBrush;
                r["CorDestaque"] = SystemColors.HighlightBrush;
                r["CorTextoDestaque"] = SystemColors.HighlightTextBrush;
                r["CorLaranjaSuave"] = SystemColors.WindowBrush;
                r["CorTrilhoBarra"] = SystemColors.WindowBrush;
                r["CorBordaInterruptor"] = SystemColors.WindowTextBrush;
                r["CorBolinha"] = SystemColors.WindowTextBrush;
                r["CorFoco"] = SystemColors.WindowTextBrush;
                r["CorFocoInterno"] = SystemColors.WindowBrush;
                r["NivelOk"] = SystemColors.WindowTextBrush;
                r["NivelAtencao"] = SystemColors.WindowTextBrush;
                r["NivelAlto"] = SystemColors.WindowTextBrush;
                r["CorBorda"] = SystemColors.WindowTextBrush;
                r["EspessuraBorda"] = new Thickness(1);
                return;
            }
            bool e = Escuro;
            uint texto = e ? 0xFFFFFFu : 0x1A1A1Au;
            r["CorJanela"] = Pincel(e ? 0xFF202020u : 0xFFF3F3F3u);
            r["CorCartao"] = UsandoMica ? Pincel(0xFFFFFFu, e ? 5.4 : 70) : Pincel(e ? 0xFF2B2B2Bu : 0xFFFBFBFBu);
            // A borda fina dos cartões do Windows 11 (Card Stroke): separa o cartão do fundo nos dois temas.
            r["CorBordaCartao"] = e ? Pincel(0x000000u, 10) : Pincel(0x000000u, 6);
            r["CorPrevia"] = e ? Pincel(0x1C1C1Cu, 88) : Pincel(0xFFFFFFu, 88);
            r["CorTexto"] = Pincel(0xFF000000u | texto);
            r["CorSecundaria"] = Pincel(e ? 0xFFC5C5C5u : 0xFF5C5C5Cu);
            r["CorDivisor"] = e ? Pincel(0xFFFFFFu, 8) : Pincel(0x000000u, 8);
            r["CorSegmentos"] = e ? Pincel(0xFFFFFFu, 8) : Pincel(0x000000u, 6);
            r["CorHover"] = e ? Pincel(0xFFFFFFu, 6) : Pincel(0x000000u, 4);
            r["CorDestaque"] = Pincel(0xFFB85C38u);
            r["CorTextoDestaque"] = Pincel(0xFFFFFFFFu);
            r["CorLaranjaSuave"] = Pincel(0xD87656u, 14);
            r["CorTrilhoBarra"] = Pincel(texto, 16);
            r["CorBordaInterruptor"] = Pincel(texto, 55);
            r["CorBolinha"] = Pincel(0xFF000000u | texto);
            // Anel de foco como o do Windows 11: claro por fora no escuro, escuro por fora no claro, com o
            // contorno interno do outro tom. Sobre o laranja escolhido, o laranja não daria 3:1.
            r["CorFoco"] = Pincel(0xFF000000u | texto);
            r["CorFocoInterno"] = Pincel(e ? 0xFF000000u : 0xFFFFFFFFu);
            r["NivelOk"] = Pincel(e ? 0xFF5DD07Au : 0xFF1E7B34u);
            r["NivelAtencao"] = Pincel(e ? 0xFFFFB340u : 0xFF9A4F00u);
            r["NivelAlto"] = Pincel(e ? 0xFFFF6B6Bu : 0xFFB3261Eu);
            r["CorBorda"] = Brushes.Transparent;
            r["EspessuraBorda"] = new Thickness(0);
        }

        // O pincel atual de um token, para quem desenha em código.
        public static Brush Cor(string chave) => Application.Current.Resources[chave] as Brush ?? Brushes.Magenta;
    }
}
