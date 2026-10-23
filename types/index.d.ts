export type Idioma = 'en' | 'pt'
export type Moeda = 'USD' | 'BRL' | 'EUR'
export type Mascote = 'animado' | 'parado' | 'oculto'

export type Preferencias = { idioma: Idioma; moeda: Moeda; mascote: Mascote; limitePorModelo: boolean }

export type Limite = { tipo: string; pct: number | null; reinicia: string | null }

// O que a banda desenha. Sem carimbo de hora: só muda quando um número muda, para não redesenhar à toa.
export type Leitura = {
  modelo: string
  pct: number | null
  tokens: number | null
  janela: number
  usd: number | null
  limites: Limite[]
}

export type LimiteModelo = { modelo: string; pct: number | null; reinicia: string | null }

// Limite semanal por modelo (ex.: Fable). `em` é a última tentativa; `lidoEm`, a última que deu certo.
export type LeituraModelos = {
  em: number
  lidoEm: number | null
  estado: 'ok' | 'sem-credencial' | 'recusado' | 'erro'
  detalhe: string
  limites: LimiteModelo[]
}

// Câmbio a partir do dólar. `em` é a última tentativa; `lidoEm`, a última que deu certo;
// `falhas` conta as tentativas seguidas que falharam (a espera cresce com elas).
export type Cambio = { em: number; lidoEm: number | null; falhas: number; taxas: Partial<Record<Moeda, number>> }

declare module 'claude-code' {
  interface PluginState {
    'usage-band-mod': {
      leitura: Leitura | null
      oculta: boolean
      modelos: LeituraModelos | null
      cambio: Cambio | null
      // Preferências que a janela de ajustes mudou e ainda não foram gravadas no userConfig.
      ajuste: Preferencias | null
      relogio: number
      // Onde roda e se a janela de ajustes existe nele: descoberto uma vez por sessão; o ⚙ só aparece com ela.
      sistema: { plataforma: 'macos' | 'windows'; disponivel: boolean } | null
    }
  }
}
