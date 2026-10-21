// O mascote em pixel: os mesmos retângulos e o mesmo ciclo do app do Mac (40 passos de 120 ms, pisca
// nos passos 0 e 21, pulinho nos passos 30 a 33). Cada pixel de arte cai num número inteiro de pixels
// da tela, para a arte sair nítida em qualquer escala.
using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace PainelDeUso
{
    public sealed class Mascote : FrameworkElement
    {
        // Corpo 16×10, de cima para baixo: (x, y, largura, altura) em pixels de arte.
        private static readonly int[][] Corpo =
        {
            new[] { 2, 0, 12, 4 }, new[] { 0, 4, 16, 2 }, new[] { 2, 6, 12, 2 },
            new[] { 3, 8, 1, 2 }, new[] { 5, 8, 1, 2 }, new[] { 10, 8, 1, 2 }, new[] { 12, 8, 1, 2 },
        };
        private static readonly int[] Olhos = { 4, 11 };
        private static readonly double[] Pulo = { -1, -2, -2, -1 };

        private static readonly Brush Laranja = Congelar(new SolidColorBrush(Color.FromRgb(0xD8, 0x76, 0x56)));
        private static readonly Brush Olho = Congelar(new SolidColorBrush(Color.FromRgb(0x14, 0x14, 0x13)));

        // No --print o desenho fica no quadro de repouso: a imagem sai igual toda vez.
        public static bool Congelado { get; set; }

        public static readonly DependencyProperty EstiloProperty = DependencyProperty.Register(
            nameof(Estilo), typeof(EstiloMascote), typeof(Mascote),
            new FrameworkPropertyMetadata(EstiloMascote.animado, FrameworkPropertyMetadataOptions.AffectsRender, (d, _) => ((Mascote)d).Relogio()));

        public static readonly DependencyProperty TamanhoProperty = DependencyProperty.Register(
            nameof(Tamanho), typeof(double), typeof(Mascote),
            new FrameworkPropertyMetadata(2.0, FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public EstiloMascote Estilo { get => (EstiloMascote)GetValue(EstiloProperty); set => SetValue(EstiloProperty, value); }

        // Tamanho de um pixel de arte, em DIP (1.1 na prévia, 2 no cabeçalho).
        public double Tamanho { get => (double)GetValue(TamanhoProperty); set => SetValue(TamanhoProperty, value); }

        private DispatcherTimer? relogio;
        private int passo;

        public Mascote()
        {
            SnapsToDevicePixels = true;
            RenderOptions.SetEdgeMode(this, EdgeMode.Aliased);
            Loaded += (_, __) => Relogio();
            Unloaded += (_, __) => Parar();
        }

        private static Brush Congelar(Brush b)
        {
            b.Freeze();
            return b;
        }

        private bool Anda => Estilo == EstiloMascote.animado && !Tema.MovimentoReduzido && !Congelado && IsLoaded;

        // Liga o relógio só quando o mascote anda: parado ou com movimento reduzido, nada redesenha.
        public void Relogio()
        {
            if (!Anda)
            {
                Parar();
                passo = 0;
                InvalidateVisual();
                return;
            }
            if (relogio != null) return;
            relogio = new DispatcherTimer(DispatcherPriority.Render) { Interval = TimeSpan.FromMilliseconds(120) };
            relogio.Tick += (_, __) =>
            {
                passo = (passo + 1) % 40;
                InvalidateVisual();
            };
            relogio.Start();
        }

        private void Parar()
        {
            relogio?.Stop();
            relogio = null;
        }

        // O pixel de arte em DIP, arredondado para um número inteiro de pixels da tela.
        private double Pixel()
        {
            double escala = VisualTreeHelper.GetDpi(this).DpiScaleX;
            return Math.Max(1, Math.Round(Tamanho * escala)) / escala;
        }

        protected override Size MeasureOverride(Size disponivel)
        {
            double p = Pixel();
            return new Size(16 * p, 12 * p);
        }

        protected override void OnRender(DrawingContext dc)
        {
            bool anda = Anda;
            int ciclo = anda ? passo : 5;
            bool piscando = anda && (ciclo == 0 || ciclo == 21);
            double pulo = anda && ciclo >= 30 && ciclo <= 33 ? Pulo[ciclo - 30] : 0;
            double p = Pixel();
            // "oculto" nunca chega aqui: a prévia tira o mascote e o cabeçalho o mostra parado.
            Desenhar(dc, p, (2 + pulo) * p, piscando);
        }

        private static void Desenhar(DrawingContext dc, double p, double dy, bool piscando)
        {
            foreach (var r in Corpo) dc.DrawRectangle(Laranja, null, new Rect(r[0] * p, r[1] * p + dy, r[2] * p, r[3] * p));
            foreach (var x in Olhos)
            {
                var olho = piscando ? new Rect(x * p, 3 * p + dy, p, p) : new Rect(x * p, 2 * p + dy, p, 2 * p);
                dc.DrawRectangle(Olho, null, olho);
            }
        }

        protected override AutomationPeer OnCreateAutomationPeer() => new PeerImagem(this);

        // Ícone da janela e da barra de tarefas: um .ico em memória com 16, 32 e 48 px, cada um com
        // pixels de arte inteiros (1, 2 e 3 px), para não sair borrado em nenhuma escala.
        public static ImageSource Icone()
        {
            var tamanhos = new[] { 16, 32, 48 };
            var pngs = new List<byte[]>();
            foreach (var lado in tamanhos)
            {
                int p = lado / 16;
                var dv = new DrawingVisual();
                RenderOptions.SetEdgeMode(dv, EdgeMode.Aliased);
                using (var dc = dv.RenderOpen()) Desenhar(dc, p, (lado - 10 * p) / 2.0, false);
                var rtb = new RenderTargetBitmap(lado, lado, 96, 96, PixelFormats.Pbgra32);
                rtb.Render(dv);
                var enc = new PngBitmapEncoder();
                enc.Frames.Add(BitmapFrame.Create(rtb));
                using var ms = new MemoryStream();
                enc.Save(ms);
                pngs.Add(ms.ToArray());
            }
            var ico = new MemoryStream();
            var w = new BinaryWriter(ico);
            w.Write((short)0);
            w.Write((short)1);
            w.Write((short)tamanhos.Length);
            int deslocamento = 6 + 16 * tamanhos.Length;
            for (int i = 0; i < tamanhos.Length; i++)
            {
                w.Write((byte)tamanhos[i]);
                w.Write((byte)tamanhos[i]);
                w.Write((byte)0);
                w.Write((byte)0);
                w.Write((short)1);
                w.Write((short)32);
                w.Write(pngs[i].Length);
                w.Write(deslocamento);
                deslocamento += pngs[i].Length;
            }
            foreach (var png in pngs) w.Write(png);
            w.Flush();
            ico.Position = 0;
            var decoder = new IconBitmapDecoder(ico, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
            return decoder.Frames[0];
        }
    }

    // Um desenho com nome para leitores de tela (o mascote, a prévia): tipo Imagem, sem filhos expostos.
    public sealed class PeerImagem : FrameworkElementAutomationPeer
    {
        public PeerImagem(FrameworkElement dono) : base(dono) { }

        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Image;

        protected override string GetClassNameCore() => Owner.GetType().Name;

        protected override List<AutomationPeer>? GetChildrenCore() => null;
    }
}
