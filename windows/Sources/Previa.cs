// A banda em miniatura, numa linha só, como ela aparece acima do prompt: mascote, modelo, custo,
// barras de contexto, 5h, 7d e por modelo, e os ícones de ajustes e fechar. Fica dentro de um
// Viewbox que só encolhe: se não couber, a linha diminui inteira, sem quebrar (como no Mac).
using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Shapes;

namespace PainelDeUso
{
    public sealed class Previa : StackPanel
    {
        private Ajustes? ajustes;

        public Previa()
        {
            Orientation = Orientation.Horizontal;
            TextElement.SetFontSize(this, 11);
            SnapsToDevicePixels = true;
        }

        public Ajustes? Ajustes
        {
            get => ajustes;
            set
            {
                if (ajustes != null) ajustes.PropertyChanged -= Mudou;
                ajustes = value;
                if (ajustes != null) ajustes.PropertyChanged += Mudou;
                Montar();
            }
        }

        private void Mudou(object? _, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(PainelDeUso.Ajustes.NomeDaPrevia)) Montar();
        }

        private void Montar()
        {
            Children.Clear();
            var a = ajustes;
            if (a == null) return;
            AutomationProperties.SetName(this, a.NomeDaPrevia);

            var cabeca = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            if (a.Mascote != EstiloMascote.oculto)
                cabeca.Children.Add(new Mascote { Estilo = a.Mascote, Tamanho = 1.1, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 4, 0) });
            cabeca.Children.Add(Texto(a.Amostra.Modelo, "CorTexto", FontWeights.SemiBold));
            cabeca.Children.Add(Texto("· " + a.Custo(), "CorSecundaria", FontWeights.Normal, new Thickness(4, 0, 0, 0)));
            Children.Add(cabeca);

            Children.Add(Barra(a.T.Contexto, a.Amostra.Contexto));
            Children.Add(Barra("5h", a.Amostra.CincoHoras));
            Children.Add(Barra("7d", a.Amostra.Semana));
            var m = a.PrimeiroLimite;
            if (m != null) Children.Add(Barra(m.Modelo, m.Pct));

            var icones = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(9, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            icones.Children.Add(Icone(Tema.Engrenagem, new Thickness(0)));
            icones.Children.Add(Icone(Tema.Fechar, new Thickness(6, 0, 0, 0)));
            Children.Add(icones);
        }

        private static TextBlock Texto(string texto, string cor, FontWeight peso, Thickness margem = default)
        {
            var t = new TextBlock { Text = texto, FontWeight = peso, Margin = margem, VerticalAlignment = VerticalAlignment.Center };
            t.SetResourceReference(TextBlock.ForegroundProperty, cor);
            return t;
        }

        private static TextBlock Icone(string glifo, Thickness margem)
        {
            var t = new TextBlock { Text = glifo, FontSize = 10, Margin = margem, VerticalAlignment = VerticalAlignment.Center };
            t.SetResourceReference(TextBlock.FontFamilyProperty, "FonteIcones");
            t.SetResourceReference(TextBlock.ForegroundProperty, "CorSecundaria");
            return t;
        }

        // Uma barra como a da banda: rótulo apagado, trilho reto e preenchimento na cor do nível.
        private static FrameworkElement Barra(string rotulo, double pct)
        {
            string nivel = pct >= 85 ? "NivelAlto" : pct >= 60 ? "NivelAtencao" : "NivelOk";
            var linha = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(9, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            linha.Children.Add(Texto(rotulo, "CorSecundaria", FontWeights.Normal));
            var trilho = new Grid { Width = 26, Height = 5, Margin = new Thickness(4, 0, 4, 0), VerticalAlignment = VerticalAlignment.Center };
            // Em alto contraste o trilho ganha borda: sem ela, some no fundo.
            var fundo = new Border();
            fundo.SetResourceReference(Border.BackgroundProperty, "CorTrilhoBarra");
            fundo.SetResourceReference(Border.BorderBrushProperty, "CorBorda");
            fundo.SetResourceReference(Border.BorderThicknessProperty, "EspessuraBorda");
            var cheio = new Rectangle { Width = 26 * Math.Min(1, Math.Max(0, pct) / 100), HorizontalAlignment = HorizontalAlignment.Left };
            cheio.SetResourceReference(Shape.FillProperty, nivel);
            trilho.Children.Add(fundo);
            trilho.Children.Add(cheio);
            linha.Children.Add(trilho);
            var numero = Texto(Ajustes.Pct(pct), nivel, FontWeights.Normal);
            Typography.SetNumeralAlignment(numero, FontNumeralAlignment.Tabular);
            linha.Children.Add(numero);
            return linha;
        }

        protected override AutomationPeer OnCreateAutomationPeer() => new PeerImagem(this);
    }
}
