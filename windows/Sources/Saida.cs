// A conversa com o mod: linhas JSON na saída padrão, em UTF-8 sem BOM, terminadas em \n.
//   {"pronto":true}            assim que a janela aparece
//   {"prefs":{...}}            a cada mudança (chaves em ordem alfabética, como no app do Mac)
//   {"fim":true}               ao fechar
// Nada mais sai pela saída padrão; diagnósticos vão para o stderr, cuja última linha o mod mostra
// quando o app falha antes do "pronto".
using System;
using System.IO;
using System.Text;

namespace PainelDeUso
{
    public static class Saida
    {
        private static TextWriter? saida;
        private static TextWriter? erros;

        public static void Iniciar()
        {
            saida = Abrir(() => Console.OpenStandardOutput());
            erros = Abrir(() => Console.OpenStandardError());
        }

        // Aberto por duplo clique, o app não tem saída padrão: segue como visualizador, sem falar com ninguém.
        private static TextWriter? Abrir(Func<Stream> fluxo)
        {
            try
            {
                return new StreamWriter(fluxo(), new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
            }
            catch (Exception)
            {
                return null;
            }
        }

        public static void Pronto() => Linha("{\"pronto\":true}");

        public static void Fim() => Linha("{\"fim\":true}");

        // Os valores são nomes de enum e um booleano: nada a escapar.
        public static void Prefs(Ajustes a) => Linha(
            "{\"prefs\":{\"idioma\":\"" + a.Idioma + "\",\"limitePorModelo\":" + (a.LimitePorModelo ? "true" : "false") +
            ",\"mascote\":\"" + a.Mascote + "\",\"moeda\":\"" + a.Moeda + "\"}}");

        public static void Erro(string texto) => Escrever(erros, texto.Replace('\r', ' ').Replace('\n', ' '));

        private static void Linha(string json) => Escrever(saida, json);

        private static void Escrever(TextWriter? w, string texto)
        {
            if (w == null) return;
            try
            {
                w.WriteLine(texto);
            }
            catch (IOException)
            {
                // O mod fechou o cano (sessão encerrada): a janela continua até a pessoa fechar.
            }
            catch (ObjectDisposedException)
            {
            }
        }
    }
}
