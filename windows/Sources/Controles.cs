// Os controles que o WPF não traz prontos no jeito do Windows 11: o segmentado (botões de opção lado a
// lado, com teclado de grupo), o interruptor animado e o texto com espaçamento entre letras. A
// aparência de cada um está em Controles.xaml.
using System;
using System.Globalization;
using System.Linq;
using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;

namespace PainelDeUso
{
    // IsChecked de um botão de opção ligado a um enum: marcado quando o valor é o do parâmetro.
    public sealed class IgualA : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture) =>
            value != null && string.Equals(value.ToString(), parameter as string, StringComparison.Ordinal);

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
            value is bool b && b && parameter is string s ? Enum.Parse(targetType, s) : Binding.DoNothing;
    }

    // O segmentado: segmentos de mesma largura, separador fino entre dois segmentos não escolhidos,
    // uma parada de Tab só (a do escolhido) e as setas trocando a escolha, como num grupo de opções.
    public sealed class GrupoSegmentos : Panel
    {
        public GrupoSegmentos()
        {
            KeyboardNavigation.SetTabNavigation(this, KeyboardNavigationMode.Local);
            KeyboardNavigation.SetDirectionalNavigation(this, KeyboardNavigationMode.None);
            AddHandler(ToggleButton.CheckedEvent, new RoutedEventHandler((_, __) => Atualizar()));
            AddHandler(ToggleButton.UncheckedEvent, new RoutedEventHandler((_, __) => Atualizar()));
            Loaded += (_, __) => Atualizar();
        }

        private RadioButton[] Segmentos => InternalChildren.OfType<RadioButton>().ToArray();

        private void Atualizar()
        {
            var s = Segmentos;
            for (int i = 0; i < s.Length; i++)
            {
                // Roving tabindex: só o escolhido recebe o Tab; as setas andam entre os outros.
                s[i].IsTabStop = s[i].IsChecked == true || (i == 0 && !s.Any(x => x.IsChecked == true));
                System.Windows.Automation.AutomationProperties.SetPositionInSet(s[i], i + 1);
                System.Windows.Automation.AutomationProperties.SetSizeOfSet(s[i], s.Length);
            }
            InvalidateVisual();
        }

        protected override void OnPreviewKeyDown(KeyEventArgs e)
        {
            base.OnPreviewKeyDown(e);
            var s = Segmentos;
            int atual = Array.FindIndex(s, x => x.IsKeyboardFocusWithin);
            if (atual < 0) return;
            int novo;
            switch (e.Key)
            {
                case Key.Left: case Key.Up: novo = Math.Max(0, atual - 1); break;
                case Key.Right: case Key.Down: novo = Math.Min(s.Length - 1, atual + 1); break;
                case Key.Home: novo = 0; break;
                case Key.End: novo = s.Length - 1; break;
                default: return;
            }
            e.Handled = true;
            s[novo].IsChecked = true;
            s[novo].Focus();
        }

        protected override Size MeasureOverride(Size disponivel)
        {
            double largura = 0, altura = 0;
            foreach (UIElement c in InternalChildren)
            {
                c.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
                largura = Math.Max(largura, c.DesiredSize.Width);
                altura = Math.Max(altura, c.DesiredSize.Height);
            }
            return new Size(Math.Ceiling(largura) * InternalChildren.Count, altura);
        }

        protected override Size ArrangeOverride(Size final)
        {
            int n = InternalChildren.Count;
            double largura = n == 0 ? 0 : final.Width / n;
            for (int i = 0; i < n; i++) InternalChildren[i].Arrange(new Rect(i * largura, 0, largura, final.Height));
            return final;
        }

        protected override void OnRender(DrawingContext dc)
        {
            base.OnRender(dc);
            var s = Segmentos;
            if (s.Length < 2 || !(TryFindResource("CorDivisor") is Brush cor)) return;
            double largura = ActualWidth / s.Length;
            double escala = VisualTreeHelper.GetDpi(this).DpiScaleX;
            double linha = 1 / escala;
            for (int i = 1; i < s.Length; i++)
            {
                if (s[i - 1].IsChecked == true || s[i].IsChecked == true) continue;
                double x = Math.Round(i * largura * escala) / escala - linha / 2;
                dc.DrawRectangle(cor, null, new Rect(x, ActualHeight * 0.25, linha, ActualHeight * 0.5));
            }
        }

        protected override AutomationPeer OnCreateAutomationPeer() => new PeerGrupo(this);
    }

    // O segmentado aparece para o leitor de tela como um grupo com o nome da linha.
    public sealed class PeerGrupo : FrameworkElementAutomationPeer
    {
        public PeerGrupo(FrameworkElement dono) : base(dono) { }

        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Group;

        protected override string GetClassNameCore() => nameof(GrupoSegmentos);
    }

    // Interruptor do Windows 11: desligado, trilho vazado e bolinha de 12; ligado, trilho cheio e
    // bolinha de 14 à direita. A bolinha anda em 150 ms, salvo com movimento reduzido.
    public sealed class Interruptor : CheckBox
    {
        private const double Lado = 14;
        private const double XDesligado = 10 - Lado / 2; // centro em 10 (4 de folga + 6 de raio)
        private const double XLigado = 30 - Lado / 2;    // centro em 30 (3 de folga + 7 de raio)
        private const double EscalaDesligado = 12 / Lado;

        private TranslateTransform? desloca;
        private ScaleTransform? escala;

        public override void OnApplyTemplate()
        {
            base.OnApplyTemplate();
            desloca = GetTemplateChild("Desloca") as TranslateTransform;
            escala = GetTemplateChild("Escala") as ScaleTransform;
            Posicionar(false);
        }

        protected override void OnChecked(RoutedEventArgs e)
        {
            base.OnChecked(e);
            Posicionar(true);
        }

        protected override void OnUnchecked(RoutedEventArgs e)
        {
            base.OnUnchecked(e);
            Posicionar(true);
        }

        private void Posicionar(bool animar)
        {
            if (desloca == null || escala == null) return;
            bool ligado = IsChecked == true;
            double x = ligado ? XLigado : XDesligado;
            double k = ligado ? 1 : EscalaDesligado;
            if (!animar || Tema.MovimentoReduzido || !IsLoaded)
            {
                desloca.BeginAnimation(TranslateTransform.XProperty, null);
                escala.BeginAnimation(ScaleTransform.ScaleXProperty, null);
                escala.BeginAnimation(ScaleTransform.ScaleYProperty, null);
                desloca.X = x;
                escala.ScaleX = escala.ScaleY = k;
                return;
            }
            var tempo = new Duration(TimeSpan.FromMilliseconds(150));
            var suave = new CubicEase { EasingMode = EasingMode.EaseOut };
            desloca.BeginAnimation(TranslateTransform.XProperty, new DoubleAnimation(x, tempo) { EasingFunction = suave });
            escala.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(k, tempo) { EasingFunction = suave });
            escala.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(k, tempo) { EasingFunction = suave });
        }
    }

    // Texto com espaçamento entre letras (o WPF não tem "tracking"): o rótulo PREVIEW, como no Mac.
    public sealed class TextoEspacado : FrameworkElement
    {
        public static readonly DependencyProperty TextoProperty = DependencyProperty.Register(
            nameof(Texto), typeof(string), typeof(TextoEspacado),
            new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public static readonly DependencyProperty EspacamentoProperty = DependencyProperty.Register(
            nameof(Espacamento), typeof(double), typeof(TextoEspacado),
            new FrameworkPropertyMetadata(0.0, FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public static readonly DependencyProperty ForegroundProperty = TextElement.ForegroundProperty.AddOwner(typeof(TextoEspacado),
            new FrameworkPropertyMetadata(Brushes.Black, FrameworkPropertyMetadataOptions.Inherits | FrameworkPropertyMetadataOptions.AffectsRender));

        public static readonly DependencyProperty FontSizeProperty = TextElement.FontSizeProperty.AddOwner(typeof(TextoEspacado),
            new FrameworkPropertyMetadata(12.0, FrameworkPropertyMetadataOptions.Inherits | FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public static readonly DependencyProperty FontWeightProperty = TextElement.FontWeightProperty.AddOwner(typeof(TextoEspacado),
            new FrameworkPropertyMetadata(FontWeights.Normal, FrameworkPropertyMetadataOptions.Inherits | FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public static readonly DependencyProperty FontFamilyProperty = TextElement.FontFamilyProperty.AddOwner(typeof(TextoEspacado),
            new FrameworkPropertyMetadata(SystemFonts.MessageFontFamily, FrameworkPropertyMetadataOptions.Inherits | FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsRender));

        public string Texto { get => (string)GetValue(TextoProperty); set => SetValue(TextoProperty, value); }
        public double Espacamento { get => (double)GetValue(EspacamentoProperty); set => SetValue(EspacamentoProperty, value); }
        public Brush Foreground { get => (Brush)GetValue(ForegroundProperty); set => SetValue(ForegroundProperty, value); }
        public double FontSize { get => (double)GetValue(FontSizeProperty); set => SetValue(FontSizeProperty, value); }
        public FontWeight FontWeight { get => (FontWeight)GetValue(FontWeightProperty); set => SetValue(FontWeightProperty, value); }
        public FontFamily FontFamily { get => (FontFamily)GetValue(FontFamilyProperty); set => SetValue(FontFamilyProperty, value); }

        private FormattedText Letra(string c) => new FormattedText(
            c, CultureInfo.InvariantCulture, FlowDirection.LeftToRight,
            new Typeface(FontFamily, FontStyles.Normal, FontWeight, FontStretches.Normal), FontSize, Foreground,
            VisualTreeHelper.GetDpi(this).PixelsPerDip);

        protected override Size MeasureOverride(Size disponivel)
        {
            var texto = Texto ?? "";
            double largura = 0, altura = Letra(" ").Height;
            for (int i = 0; i < texto.Length; i++) largura += Letra(texto[i].ToString()).WidthIncludingTrailingWhitespace + (i < texto.Length - 1 ? Espacamento : 0);
            return new Size(largura, altura);
        }

        protected override void OnRender(DrawingContext dc)
        {
            var texto = Texto ?? "";
            double x = 0;
            foreach (var c in texto)
            {
                var f = Letra(c.ToString());
                dc.DrawText(f, new Point(x, 0));
                x += f.WidthIncludingTrailingWhitespace + Espacamento;
            }
        }

        protected override AutomationPeer OnCreateAutomationPeer() => new PeerTexto(this);
    }

    public sealed class PeerTexto : FrameworkElementAutomationPeer
    {
        public PeerTexto(TextoEspacado dono) : base(dono) { }

        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Text;

        protected override string GetNameCore() => ((TextoEspacado)Owner).Texto ?? "";

        protected override string GetClassNameCore() => nameof(TextoEspacado);
    }
}
