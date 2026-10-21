// Funções puras: nomes de modelo, números, dinheiro, tempo, cores, barras e o encaixe da banda.
import type { Idioma, Moeda } from '../types'

// "claude-opus-5-5" → "Opus 5.5". Aceita os formatos do Bedrock (us.anthropic.claude-…-v1:0),
// do Vertex (claude-…@20250805) e sufixos como [1m].
export function nomeBonito(id: string): string {
  let s = id.trim().toLowerCase()
  const i = s.lastIndexOf('claude-')
  if (i >= 0) s = s.slice(i + 'claude-'.length)
  s = s.replace(/\[[^\]]*\]$/, '').replace(/@.*$/, '').replace(/-v\d+(:\d+)?$/, '')
  const partes = s.split('-').filter(p => p !== '' && !/^\d{8}$/.test(p))
  const nome = partes.find(p => !/^\d+$/.test(p))
  if (nome === undefined) return id
  const versao = partes.filter(p => /^\d+$/.test(p)).slice(0, 2).join('.')
  const titulo = nome.charAt(0).toUpperCase() + nome.slice(1)
  return versao === '' ? titulo : `${titulo} ${versao}`
}

export function curto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

// Número com casas e separadores do idioma: 1.234,56 em português, 1,234.56 em inglês.
export function numero(n: number, casas: number, idioma: Idioma): string {
  const [inteiro = '0', fracao = ''] = Math.abs(n).toFixed(casas).split('.')
  const mil = idioma === 'pt' ? '.' : ','
  const dec = idioma === 'pt' ? ',' : '.'
  const corpo = inteiro.replace(/\B(?=(\d{3})+$)/g, mil) + (casas > 0 ? dec + fracao : '')
  return n < 0 ? `-${corpo}` : corpo
}

const SIMBOLO: Record<Moeda, Record<Idioma, string>> = {
  USD: { en: '$', pt: 'US$ ' },
  BRL: { en: 'R$', pt: 'R$ ' },
  EUR: { en: '€', pt: '€ ' },
}

// Custo em dólar mostrado na moeda escolhida. Sem taxa para ela, fica em dólar em vez de inventar.
export function dinheiro(usd: number, moeda: Moeda, taxa: number | null, idioma: Idioma): string {
  if (moeda === 'USD' || taxa === null) return SIMBOLO.USD[idioma] + numero(usd, 2, idioma)
  return SIMBOLO[moeda][idioma] + numero(usd * taxa, 2, idioma)
}

export function faltam(iso: string | null, agora: number): string {
  if (iso === null) return ''
  const ms = Date.parse(iso) - agora
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60_000)
  if (min >= 1_440) return `${Math.floor(min / 1_440)}d ${Math.floor((min % 1_440) / 60)}h`
  if (min >= 60) return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
  return `${min}m`
}

export function corDe(pct: number | null): 'success' | 'warning' | 'error' | 'subtle' {
  if (pct === null) return 'subtle'
  if (pct >= 85) return 'error'
  if (pct >= 60) return 'warning'
  return 'success'
}

// Preenchimento e trilho em células inteiras, desenhados como fundo pintado (a banda pinta o fundo
// de espaços): sem emendas entre células, sem depender de glifo da fonte, da mesma altura do mascote.
// Célula inteira: no Terminal.app o glifo de bloco é mais baixo que a célula, e um oitavo (▍) deixaria
// um buraco ou um degrau antes do trilho.
// Nos extremos a célula inteira mentiria: uso acima de 0 mostra ao menos uma célula cheia, e uso
// abaixo de 100 deixa ao menos uma vazia. Sem leitura não há barra (quem desenha põe outra coisa).
export function barra(pct: number | null, largura: number): { cheio: string; vazio: string } {
  if (pct === null) return { cheio: '', vazio: '' }
  const p = Math.max(0, Math.min(100, pct))
  let n = Math.round((p / 100) * largura)
  if (p > 0 && n === 0) n = Math.min(1, largura)
  if (p < 100 && n === largura && largura > 1) n = largura - 1
  return { cheio: ' '.repeat(n), vazio: ' '.repeat(Math.max(0, largura - n)) }
}

// `extra` é o detalhe já escrito: "↻ 2h 10m" para um reinício, "112k/200k" para o contexto.
export type Trecho = { rotulo: string; pct: number | null; extra: string }

// A linha começa depois de um recuo de uma coluna (paddingLeft do Box, como o resto do Claude Code)
// e, com barras, para uma coluna antes da borda. Toda conta de largura soma o recuo.
export const RECUO = 1
const MARGEM_DIREITA = 1
// Espaço antes de cada trecho: três com barras (a barra já separa, mas o detalhe dim encostava
// no rótulo seguinte), dois no modo compacto, onde o trecho é só "Rótulo 56%".
export const SEP_BARRAS = 3
export const SEP_COMPACTO = 2

// Partes do cabeçalho, em colunas: o glifo do mascote (com o espaço), o modelo e o custo.
export type Cabeca = { glifo: number; modelo: number; custo: number }
export type NivelCabeca = 'toda' | 'sem-custo' | 'so-modelo' | 'nada'

export type Encaixe = { w: number; resto: number; comExtra: boolean; cabeca: NivelCabeca; mostrar: number }

// O percentual como a banda escreve: "56%", ou "—" sem leitura.
export const pctTexto = (pct: number | null): string => (pct === null ? '—' : `${Math.round(pct)}%`)
// O percentual ocupa sempre 4 colunas (o que falta vira espaço no fim do trecho): o número encosta
// na barra dele e a barra não anda quando o número ganha um dígito.
export const PCT_COLUNAS = 4

const largCabeca = (c: Cabeca, nivel: NivelCabeca): number =>
  nivel === 'toda' ? c.glifo + c.modelo + c.custo : nivel === 'sem-custo' ? c.glifo + c.modelo : nivel === 'so-modelo' ? c.modelo : 0

// Banda de uma linha só no terminal. Com barras, cada trecho é "   Rótulo ███░░ 56% ↻ 2h 10m" e as
// barras dividem por igual o espaço que sobra (`resto` barras, as primeiras, levam uma coluna a mais).
// Sem barras, o trecho fica compacto: "  Rótulo 56%".
// O que sai quando aperta, nesta ordem: o detalhe, as barras, o custo, o mascote, o modelo e,
// por fim, os últimos trechos (`mostrar` diz quantos ficam).
export function encaixe(colunas: number, cabeca: Cabeca, trechos: Trecho[]): Encaixe {
  const comBarra = (t: Trecho, comExtra: boolean) => SEP_BARRAS + t.rotulo.length + 1 + 1 + PCT_COLUNAS + (comExtra && t.extra !== '' ? 1 + t.extra.length : 0)
  const compacto = (t: Trecho) => SEP_COMPACTO + t.rotulo.length + 1 + pctTexto(t.pct).length
  const n = trechos.length
  const fixoBarras = (comExtra: boolean) => largCabeca(cabeca, 'toda') + 2 + trechos.reduce((s, t) => s + comBarra(t, comExtra), 0)
  const livre = (comExtra: boolean) => colunas - RECUO - MARGEM_DIREITA - fixoBarras(comExtra)
  const dividir = (comExtra: boolean): Encaixe => ({ w: Math.floor(livre(comExtra) / n), resto: livre(comExtra) % n, comExtra, cabeca: 'toda', mostrar: n })
  if (n > 0 && livre(true) >= 5 * n) return dividir(true)
  if (n > 0 && livre(false) >= 3 * n) return dividir(false)
  const soma = (k: number) => trechos.slice(0, k).reduce((s, t) => s + compacto(t), 0)
  for (const nivel of ['toda', 'sem-custo', 'so-modelo'] as const) {
    if (RECUO + largCabeca(cabeca, nivel) + 2 + soma(n) <= colunas) return { w: 0, resto: 0, comExtra: false, cabeca: nivel, mostrar: n }
  }
  let k = n
  while (k > 0 && RECUO + 2 + soma(k) > colunas) k--
  return { w: 0, resto: 0, comExtra: false, cabeca: 'nada', mostrar: k }
}
