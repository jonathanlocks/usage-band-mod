// Só para gerar imagens do README e do CI: `--print arquivo.png` espera a janela aparecer, desenha o
// conteúdo dela no dobro da resolução, grava o PNG e fecha. Com `--recorte`, só a janela; sem ele, a
// janela com sombra sobre um fundo de exemplo (o mesmo gradiente do app do Mac).
// O que não é do WPF fica fora do desenho e não é imitado: a barra de título de verdade é do sistema
// (aqui vai uma faixa simples no lugar dela, com o ícone, o título e o botão de fechar; a janela não
// redimensiona, então o Windows não mostra minimizar e maximizar), e a Mica e os cantos redondos do
// Windows 11 são do DWM. A placa sai retangular e na cor sólida da janela, que é o que as capturas de
// tela dos runners mostram.
// Códigos de saída: 0 ok, 2 janela sem conteúdo, 3 falha ao desenhar, 4 falha ao gravar.
using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace PainelDeUso
{
    public static class Captura
    {
        private const double Margem = 56;
        private const double Faixa = 32;

        public static void Agendar(MainWindow janela, string destino, bool recorte)
        {
            Mascote.Congelado = true;
            janela.ContentRendered += (_, __) =>
            {
                var espera = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
                espera.Tick += (s, e) =>
                {
                    espera.Stop();
                    Saida.Erro(janela.Diagnostico);
                    int codigo = Gravar(janela, destino, recorte);
                    Application.Current.Shutdown(codigo);
                };
                espera.Start();
            };
        }

        private static int Gravar(MainWindow janela, string destino, bool recorte)
        {
            if (!(janela.Content is FrameworkElement cliente) || cliente.ActualWidth < 1 || cliente.ActualHeight < 1) return 2;
            BitmapSource imagem;
            try
            {
                imagem = Desenhar(janela, cliente, recorte);
            }
            catch (Exception e)
            {
                Saida.Erro("print: " + e.Message);
                return 3;
            }
            try
            {
                var enc = new PngBitmapEncoder();
                enc.Frames.Add(BitmapFrame.Create(imagem));
                using var arquivo = File.Create(destino);
                enc.Save(arquivo);
            }
            catch (Exception e)
            {
                Saida.Erro("print: " + e.Message);
                return 4;
            }
            return 0;
        }

        private static BitmapSource Desenhar(MainWindow janela, FrameworkElement cliente, bool recorte)
        {
            bool escuro = Tema.Escuro && !Tema.AltoContraste;
            double w = cliente.ActualWidth, h = cliente.ActualHeight;
            double margem = recorte ? 0 : Margem;
            double largura = w + 2 * margem, altura = h + Faixa + 2 * margem;

            // Fundo de exemplo: as mesmas três cores do app do Mac, na diagonal.
            var cores = escuro
                ? new[] { Rgb(0.10, 0.12, 0.22), Rgb(0.36, 0.17, 0.25), Rgb(0.80, 0.42, 0.29) }
                : new[] { Rgb(0.62, 0.78, 0.95), Rgb(0.93, 0.80, 0.86), Rgb(0.99, 0.86, 0.70) };
            var gradiente = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(1, 1) };
            gradiente.GradientStops.Add(new GradientStop(cores[0], 0));
            gradiente.GradientStops.Add(new GradientStop(cores[1], 0.55));
            gradiente.GradientStops.Add(new GradientStop(cores[2], 1));

            // A placa da janela: retangular, na cor sólida da janela, com a borda fina do sistema.
            var placa = new Border
            {
                Width = w,
                Height = h + Faixa,
                Background = Tema.Cor("CorJanela"),
                BorderBrush = new SolidColorBrush(escuro ? Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF) : Color.FromArgb(0x26, 0, 0, 0)),
                BorderThickness = new Thickness(1),
                Margin = new Thickness(margem),
            };
            if (!recorte)
                placa.Effect = new DropShadowEffect { BlurRadius = 40, ShadowDepth = 14, Direction = 270, Color = Colors.Black, Opacity = escuro ? 0.5 : 0.22 };

            var corpo = new DockPanel { LastChildFill = true };
            corpo.Children.Add(BarraDeTitulo(janela, escuro));
            DockPanel.SetDock(corpo.Children[0], Dock.Top);
            // O conteúdo de verdade da janela, desenhado em vetor (sai nítido no dobro da resolução).
            var conteudo = new Border
            {
                Width = w,
                Height = h,
                Background = new VisualBrush(cliente)
                {
                    Stretch = Stretch.None,
                    ViewboxUnits = BrushMappingMode.Absolute,
                    Viewbox = new Rect(0, 0, w, h),
                    ViewportUnits = BrushMappingMode.Absolute,
                    Viewport = new Rect(0, 0, w, h),
                    AlignmentX = AlignmentX.Left,
                    AlignmentY = AlignmentY.Top,
                },
            };
            corpo.Children.Add(conteudo);
            placa.Child = corpo;

            var raiz = new Grid { Width = largura, Height = altura, Background = recorte ? Brushes.Transparent : gradiente };
            raiz.Children.Add(placa);
            raiz.Measure(new Size(largura, altura));
            raiz.Arrange(new Rect(0, 0, largura, altura));
            raiz.UpdateLayout();

            var bmp = new RenderTargetBitmap((int)Math.Round(largura * 2), (int)Math.Round(altura * 2), 192, 192, PixelFormats.Pbgra32);
            bmp.Render(raiz);
            bmp.Freeze();
            return bmp;
        }

        // A faixa de título do Windows 11: ícone de 16, título em Segoe UI 12 e o botão de fechar.
        private static FrameworkElement BarraDeTitulo(MainWindow janela, bool escuro)
        {
            var texto = escuro ? Colors.White : Color.FromRgb(0x1A, 0x1A, 0x1A);
            var faixa = new Grid { Height = Faixa };
            faixa.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            faixa.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            faixa.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(46) });

            var icone = new Image { Source = janela.Icon, Width = 16, Height = 16, Margin = new Thickness(12, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            RenderOptions.SetBitmapScalingMode(icone, BitmapScalingMode.NearestNeighbor);
            faixa.Children.Add(icone);

            var titulo = new TextBlock
            {
                Text = janela.Title,
                FontFamily = new FontFamily("Segoe UI"),
                FontSize = 12,
                Foreground = new SolidColorBrush(texto),
                Margin = new Thickness(10, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center,
            };
            Grid.SetColumn(titulo, 1);
            faixa.Children.Add(titulo);

            var fechar = new TextBlock
            {
                Text = "",
                FontFamily = Tema.FonteIcones,
                FontSize = 10,
                Foreground = new SolidColorBrush(texto),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            };
            Grid.SetColumn(fechar, 2);
            faixa.Children.Add(fechar);
            return faixa;
        }

        private static Color Rgb(double r, double g, double b) => Color.FromRgb((byte)Math.Round(r * 255), (byte)Math.Round(g * 255), (byte)Math.Round(b * 255));
    }
}
