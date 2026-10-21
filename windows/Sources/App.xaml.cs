// Janela de ajustes do painel-de-uso, para Windows 10 (1903+) e 11, em WPF sobre o .NET Framework 4.8
// que já vem com o sistema.
//
// O mod abre este app com `--estado '<json>'` ({ prefs, amostra }) e escuta a saída padrão:
//   {"pronto":true}            assim que a janela aparece
//   {"prefs":{...}}            a cada mudança
//   {"fim":true}               ao fechar
// Nada mais sai daqui: o app não usa rede nem grava arquivos, salvo o PNG do --print.
//
// Opções de desenvolvedor:
//   --estado @arquivo.json     lê o estado de um arquivo
//   --print saida.png          desenha a janela num PNG (ver Captura.cs) e sai
//   --recorte                  com --print: só a janela, sem margem, sombra nem fundo de exemplo
//   --claro | --escuro         força o tema, em vez do tema do sistema
//   --win10                    força o caminho do Windows 10 (sem pedir Mica, cartões sólidos)
using System;
using System.Windows;

namespace PainelDeUso
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            Saida.Iniciar();
            AppDomain.CurrentDomain.UnhandledException += (_, ev) => Falhar(ev.ExceptionObject as Exception);
            DispatcherUnhandledException += (_, ev) =>
            {
                ev.Handled = true;
                Falhar(ev.Exception);
            };

            var args = Argumentos.Ler(e.Args);
            var ajustes = Estado.De(args.Json);
            Tema.Iniciar(args.TemaForcado, args.SemMica);
            var janela = new MainWindow(ajustes);
            MainWindow = janela;
            if (args.Png != null) Captura.Agendar(janela, args.Png, args.Recorte);
            janela.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            Saida.Fim();
            base.OnExit(e);
        }

        // Um erro que ninguém tratou: a mensagem vai para o stderr (o mod mostra a última linha) e o app sai com 1.
        private static void Falhar(Exception? erro)
        {
            Saida.Erro(erro == null ? "erro desconhecido" : $"{erro.GetType().Name}: {erro.Message}");
            Environment.Exit(1);
        }
    }

    public sealed class Argumentos
    {
        public string? Json { get; private set; }
        public string? Png { get; private set; }
        public bool? TemaForcado { get; private set; }
        public bool SemMica { get; private set; }
        public bool Recorte { get; private set; }

        public static Argumentos Ler(string[] args)
        {
            var a = new Argumentos();
            for (int i = 0; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--estado" when i + 1 < args.Length: a.Json = args[++i]; break;
                    case "--print" when i + 1 < args.Length: a.Png = args[++i]; break;
                    case "--escuro": a.TemaForcado = true; break;
                    case "--claro": a.TemaForcado = false; break;
                    case "--win10": a.SemMica = true; break;
                    case "--recorte": a.Recorte = true; break;
                }
            }
            return a;
        }
    }
}
