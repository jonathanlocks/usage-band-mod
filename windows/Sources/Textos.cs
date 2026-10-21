// Os textos da janela, em inglês e português: os mesmos 15 do app do Mac, mais os nomes que o
// Narrador e outros leitores de tela leem nos controles sem texto próprio.
using System.Globalization;

namespace PainelDeUso
{
    public sealed class Textos
    {
        private static readonly Textos EN = new Textos(false);
        private static readonly Textos PT = new Textos(true);

        public static Textos De(PainelDeUso.Idioma i) => i == PainelDeUso.Idioma.pt ? PT : EN;

        private readonly bool pt;

        private Textos(bool pt) { this.pt = pt; }

        public string Titulo => pt ? "Painel de uso" : "Usage band";
        public string Subtitulo => pt ? "Ajustes da banda acima do prompt" : "Settings for the band above the prompt";
        public string Previa => pt ? "Prévia" : "Preview";
        public string PreviaMaiusculo => Previa.ToUpper(CultureInfo.InvariantCulture);
        public string Idioma => pt ? "Idioma" : "Language";
        public string Moeda => pt ? "Moeda do custo" : "Cost currency";
        public string MoedaNota => pt ? "Dólar não usa rede; as outras moedas usam as taxas da Coinbase." : "Dollars need no network; other currencies use Coinbase rates.";
        public string Mascote => pt ? "Mascote" : "Mascot";
        public string Animado => pt ? "Animado" : "Animated";
        public string Parado => pt ? "Parado" : "Still";
        public string Oculto => pt ? "Oculto" : "Hidden";
        public string PorModelo => pt ? "Limite semanal por modelo" : "Per-model weekly limit";
        public string PorModeloNota => pt ? "Usa um endpoint interno da Anthropic, que pode mudar sem aviso." : "Uses an internal Anthropic endpoint that may change without notice.";
        public string Contexto => pt ? "Contexto" : "Context";
        public string Pronto => pt ? "Pronto" : "Done";
        public string Rodape => pt ? "As mudanças valem na hora." : "Changes apply right away.";

        // Nomes de acessibilidade.
        public string NomeDolar => pt ? "Dólar americano" : "US dollar";
        public string NomeReal => pt ? "Real brasileiro" : "Brazilian real";
        public string NomeEuro => "Euro";
        public string NomeMascote => pt ? "Mascote caranguejo em pixel" : "Pixel crab mascot";
        public string NomeFechar => pt ? "Fechar" : "Close";
        public string NomePrevia(string banda) => string.Format(CultureInfo.InvariantCulture, pt ? "Prévia da banda: {0}" : "Preview of the band: {0}", banda);
    }
}
