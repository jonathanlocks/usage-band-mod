// A janela de ajustes: liga os controles aos ajustes, aplica a barra de título escura e a Mica, diz
// "pronto" ao mod quando aparece, e fecha com Esc ou com o botão Pronto (Enter).
using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Win32;

namespace PainelDeUso
{
    public partial class MainWindow : Window
    {
        private readonly Ajustes ajustes;
        private IntPtr hwnd;
        private bool avisouPronto;

        public MainWindow(Ajustes ajustes)
        {
            this.ajustes = ajustes;
            InitializeComponent();
            DataContext = ajustes;
            Icon = Mascote.Icone();
            PreviaDaBanda.Ajustes = ajustes;
            AtualizarMascote();
            ajustes.PropertyChanged += Mudou;
            PreviewKeyDown += Tecla;
            ContentRendered += Apareceu;
            SystemEvents.UserPreferenceChanged += PreferenciaDoSistema;
        }

        private void Mudou(object? _, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(Ajustes.Mascote)) AtualizarMascote();
        }

        // No cabeçalho o mascote nunca some: com "oculto", aparece parado (como no Mac).
        private void AtualizarMascote() =>
            MascoteCabecalho.Estilo = ajustes.Mascote == EstiloMascote.oculto ? EstiloMascote.parado : ajustes.Mascote;

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            hwnd = new WindowInteropHelper(this).Handle;
            int hrEscuro = Nativo.AplicarEscuro(hwnd, Tema.Escuro);
            int hrMica = 0;
            if (Tema.MicaPossivel)
            {
                // A Mica é o fundo que o DWM desenha atrás da janela: o WPF precisa deixar o fundo vazio.
                if (PresentationSource.FromVisual(this) is HwndSource fonte && fonte.CompositionTarget != null)
                    fonte.CompositionTarget.BackgroundColor = Colors.Transparent;
                Background = Brushes.Transparent;
                Tema.UsandoMica = Nativo.AplicarMica(hwnd, out hrMica);
                if (!Tema.UsandoMica) SetResourceReference(BackgroundProperty, "CorJanela");
                Tema.Reaplicar();
            }
            Diagnostico = $"{Tema.Diagnostico()} hrEscuro=0x{hrEscuro:X8} micaPossivel={Tema.MicaPossivel} mica={Tema.UsandoMica} hrMica=0x{hrMica:X8}";
        }

        // O que o DWM respondeu, para o stderr do --print.
        public string Diagnostico { get; private set; } = "";

        private void Apareceu(object? sender, EventArgs e)
        {
            if (avisouPronto) return;
            avisouPronto = true;
            Saida.Pronto();
            Activate();
            Nativo.SetForegroundWindow(hwnd);
        }

        private void Tecla(object sender, KeyEventArgs e)
        {
            if (e.Key != Key.Escape) return;
            e.Handled = true;
            Close();
        }

        private void Pronto_Click(object sender, RoutedEventArgs e) => Close();

        // Tema, alto contraste ou animações mudaram no sistema: novas cores, nova barra de título.
        private void PreferenciaDoSistema(object sender, UserPreferenceChangedEventArgs e)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                Tema.Reaplicar();
                if (Tema.UsandoMica && !Tema.MicaPossivel)
                {
                    Nativo.TirarMica(hwnd);
                    Tema.UsandoMica = false;
                    if (PresentationSource.FromVisual(this) is HwndSource fonte && fonte.CompositionTarget != null)
                        fonte.CompositionTarget.BackgroundColor = SystemColors.WindowColor;
                    SetResourceReference(BackgroundProperty, "CorJanela");
                    Tema.Reaplicar();
                }
                Nativo.AplicarEscuro(hwnd, Tema.Escuro);
                MascoteCabecalho.Relogio();
                PreviaDaBanda.Ajustes = ajustes;
            }));
        }

        protected override void OnClosed(EventArgs e)
        {
            SystemEvents.UserPreferenceChanged -= PreferenciaDoSistema;
            ajustes.PropertyChanged -= Mudou;
            base.OnClosed(e);
        }
    }
}
