// Janela de ajustes do painel-de-uso para Windows 10 (1903+) e 11: o estado que o mod manda.
//
// O mod abre o app com `--estado '<json>'` ({ prefs, amostra }); `--estado @arquivo.json` lê o mesmo
// JSON de um arquivo (para scripts). Cada campo tem um valor padrão, igual ao do app do Mac: um JSON
// incompleto ou inválido abre a janela com os padrões, sem erro.
// O app não usa rede nem grava arquivos, salvo o PNG do --print.
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace PainelDeUso
{
    public enum Idioma { en, pt }
    public enum Moeda { USD, BRL, EUR }
    // "Mascote" é o nome do desenho (Mascote.cs); o estilo dele fica com este nome.
    public enum EstiloMascote { animado, parado, oculto }

    public sealed class LimiteDoModelo
    {
        public LimiteDoModelo(string modelo, double pct) { Modelo = modelo; Pct = pct; }
        public string Modelo { get; }
        public double Pct { get; }
    }

    // Os números da prévia. Sem amostra, os mesmos do app do Mac.
    public sealed class Amostra
    {
        public string Modelo = "Opus 5.5";
        public double Usd = 3.26;
        public double Contexto = 24;
        public double CincoHoras = 5;
        public double Semana = 1;
        public List<LimiteDoModelo> PorModelo = new List<LimiteDoModelo> { new LimiteDoModelo("Fable", 0) };
        public Dictionary<string, double> Taxas = new Dictionary<string, double>();
    }

    public sealed class Ajustes : INotifyPropertyChanged
    {
        private Idioma idioma = Idioma.en;
        private Moeda moeda = Moeda.USD;
        private EstiloMascote mascote = EstiloMascote.animado;
        private bool limitePorModelo = true;
        // Só depois de ler o estado inicial as mudanças vão para a saída.
        private bool pronto;

        public event PropertyChangedEventHandler? PropertyChanged;

        public Amostra Amostra { get; } = new Amostra();

        public Idioma Idioma { get => idioma; set { if (idioma == value) return; idioma = value; Mudou(nameof(Idioma)); } }
        public Moeda Moeda { get => moeda; set { if (moeda == value) return; moeda = value; Mudou(nameof(Moeda)); } }
        public EstiloMascote Mascote { get => mascote; set { if (mascote == value) return; mascote = value; Mudou(nameof(Mascote)); } }
        public bool LimitePorModelo { get => limitePorModelo; set { if (limitePorModelo == value) return; limitePorModelo = value; Mudou(nameof(LimitePorModelo)); } }

        // Os textos no idioma escolhido; muda junto com o idioma.
        public Textos T => Textos.De(idioma);

        // A prévia lida em voz alta: o mesmo que ela mostra, em texto.
        public string NomeDaPrevia
        {
            get
            {
                var partes = new List<string> { Amostra.Modelo, Custo(), $"{T.Contexto} {Pct(Amostra.Contexto)}", $"5h {Pct(Amostra.CincoHoras)}", $"7d {Pct(Amostra.Semana)}" };
                var m = PrimeiroLimite;
                if (m != null) partes.Add($"{m.Modelo} {Pct(m.Pct)}");
                return T.NomePrevia(string.Join(", ", partes));
            }
        }

        // A barra por modelo da prévia, quando o ajuste está ligado e há um modelo na amostra.
        public LimiteDoModelo? PrimeiroLimite => limitePorModelo && Amostra.PorModelo.Count > 0 ? Amostra.PorModelo[0] : null;

        public static string Pct(double v) => ((int)Math.Round(v, MidpointRounding.AwayFromZero)).ToString(CultureInfo.InvariantCulture) + "%";

        public void Pronto() => pronto = true;

        private void Mudou(string nome)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nome));
            if (nome == nameof(Idioma)) PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(T)));
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(NomeDaPrevia)));
            if (pronto) Saida.Prefs(this);
        }

        // Só para a prévia, quando o mod ainda não leu o câmbio.
        private static readonly Dictionary<Moeda, double> TaxaDeExemplo = new Dictionary<Moeda, double> { { Moeda.BRL, 5.4 }, { Moeda.EUR, 0.92 } };

        // Mesmo formato da banda: dólar sem conversão; o resto pela taxa.
        public string Custo()
        {
            bool pt = idioma == Idioma.pt;
            var cultura = new CultureInfo(pt ? "pt-BR" : "en-US", false);
            string Numero(double v) => v.ToString("N2", cultura);
            string dolar = (pt ? "US$ " : "$") + Numero(Amostra.Usd);
            if (moeda == Moeda.USD) return dolar;
            double taxa;
            if (!Amostra.Taxas.TryGetValue(moeda.ToString(), out taxa) && !TaxaDeExemplo.TryGetValue(moeda, out taxa)) return dolar;
            string simbolo = moeda == Moeda.BRL ? (pt ? "R$ " : "R$") : (pt ? "€ " : "€");
            return simbolo + Numero(Amostra.Usd * taxa);
        }
    }

    public static class Estado
    {
        // Lê o JSON do mod (ou de um arquivo, com @). Nada aqui lança: o que não der para ler fica no padrão.
        public static Ajustes De(string? json)
        {
            var a = new Ajustes();
            try
            {
                if (json != null && json.StartsWith("@", StringComparison.Ordinal)) json = File.ReadAllText(json.Substring(1), Encoding.UTF8);
                if (!string.IsNullOrWhiteSpace(json) && new JavaScriptSerializer().DeserializeObject(json) is Dictionary<string, object> raiz)
                {
                    if (raiz.TryGetValue("prefs", out var po) && po is Dictionary<string, object> p)
                    {
                        a.Idioma = Enum<Idioma>(p, "idioma", Idioma.en);
                        a.Moeda = Enum<Moeda>(p, "moeda", Moeda.USD);
                        a.Mascote = Enum<EstiloMascote>(p, "mascote", EstiloMascote.animado);
                        a.LimitePorModelo = p.TryGetValue("limitePorModelo", out var l) && l is bool b ? b : true;
                    }
                    if (raiz.TryGetValue("amostra", out var ao) && ao is Dictionary<string, object> am) LerAmostra(a.Amostra, am);
                }
            }
            catch (Exception e)
            {
                // JSON inválido ou arquivo que não abre: a janela abre com os padrões e o motivo vai para o stderr.
                Saida.Erro("estado ignorado: " + e.Message);
            }
            a.Pronto();
            return a;
        }

        private static void LerAmostra(Amostra s, Dictionary<string, object> am)
        {
            if (am.TryGetValue("modelo", out var mo) && mo is string modelo) s.Modelo = modelo;
            s.Usd = Numero(am, "usd") ?? s.Usd;
            s.Contexto = Numero(am, "contexto") ?? s.Contexto;
            s.CincoHoras = Numero(am, "cincoHoras") ?? s.CincoHoras;
            s.Semana = Numero(am, "semana") ?? s.Semana;
            if (am.TryGetValue("porModelo", out var lo) && lo is IEnumerable lista && !(lo is string))
            {
                var itens = new List<LimiteDoModelo>();
                foreach (var item in lista)
                {
                    if (item is Dictionary<string, object> d && d.TryGetValue("modelo", out var m) && m is string nome)
                        itens.Add(new LimiteDoModelo(nome, Numero(d, "pct") ?? 0));
                }
                if (itens.Count > 0) s.PorModelo = itens;
            }
            if (am.TryGetValue("taxas", out var to) && to is Dictionary<string, object> taxas)
            {
                foreach (var par in taxas)
                {
                    var v = ComoNumero(par.Value);
                    if (v != null) s.Taxas[par.Key] = v.Value;
                }
            }
        }

        private static T Enum<T>(Dictionary<string, object> d, string chave, T padrao) where T : struct
        {
            if (d.TryGetValue(chave, out var o) && o is string s && System.Enum.TryParse(s, false, out T v) && System.Enum.IsDefined(typeof(T), v)) return v;
            return padrao;
        }

        private static double? Numero(Dictionary<string, object> d, string chave) => d.TryGetValue(chave, out var o) ? ComoNumero(o) : null;

        private static double? ComoNumero(object? o)
        {
            switch (o)
            {
                case int i: return i;
                case long l: return l;
                case decimal m: return (double)m;
                case double x: return x;
                case float f: return f;
                default: return null;
            }
        }
    }
}
