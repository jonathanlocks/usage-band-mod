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

export function barra(pct: number | null, largura: number): { cheio: string; vazio: string } {
  const p = pct === null ? 0 : Math.max(0, Math.min(100, pct))
  const n = Math.round((p / 100) * largura)
  return { cheio: '█'.repeat(n), vazio: '░'.repeat(Math.max(0, largura - n)) }
}

export type Trecho = { rotulo: string; pct: number | null; extra: string }

const MARGEM = 2

// Partes do cabeçalho, em colunas: o glifo do mascote (com o espaço), o modelo e o custo.
export type Cabeca = { glifo: number; modelo: number; custo: number }
export type NivelCabeca = 'toda' | 'sem-custo' | 'so-modelo' | 'nada'

export type Encaixe = { w: number; resto: number; comExtra: boolean; cabeca: NivelCabeca; mostrar: number }

// O percentual como a banda escreve: "56%", ou "—" sem leitura.
export const pctTexto = (pct: number | null): string => (pct === null ? '—' : `${Math.round(pct)}%`)

const largCabeca = (c: Cabeca, nivel: NivelCabeca): number =>
  nivel === 'toda' ? c.glifo + c.modelo + c.custo : nivel === 'sem-custo' ? c.glifo + c.modelo : nivel === 'so-modelo' ? c.modelo : 0

// Banda de uma linha só no terminal. Com barras, cada trecho é "  Rótulo ███░░  56%" e as barras
// dividem por igual o espaço que sobra (`resto` barras, as primeiras, levam uma coluna a mais).
// Sem barras, o trecho fica compacto: "  Rótulo 56%".
// O que sai quando aperta, nesta ordem: o detalhe (↻), as barras, o custo, o mascote, o modelo e,
// por fim, os últimos trechos (`mostrar` diz quantos ficam).
export function encaixe(colunas: number, cabeca: Cabeca, trechos: Trecho[]): Encaixe {
  const comBarra = (t: Trecho, comExtra: boolean) => 2 + t.rotulo.length + 1 + 1 + 4 + (comExtra && t.extra !== '' ? 3 + t.extra.length : 0)
  const compacto = (t: Trecho) => 2 + t.rotulo.length + 1 + pctTexto(t.pct).length
  const n = trechos.length
  const fixoBarras = (comExtra: boolean) => largCabeca(cabeca, 'toda') + 2 + trechos.reduce((s, t) => s + comBarra(t, comExtra), 0)
  const livre = (comExtra: boolean) => colunas - MARGEM - fixoBarras(comExtra)
  const dividir = (comExtra: boolean): Encaixe => ({ w: Math.floor(livre(comExtra) / n), resto: livre(comExtra) % n, comExtra, cabeca: 'toda', mostrar: n })
  if (n > 0 && livre(true) >= 5 * n) return dividir(true)
  if (n > 0 && livre(false) >= 3 * n) return dividir(false)
  const soma = (k: number) => trechos.slice(0, k).reduce((s, t) => s + compacto(t), 0)
  for (const nivel of ['toda', 'sem-custo', 'so-modelo'] as const) {
    if (largCabeca(cabeca, nivel) + 2 + soma(n) <= colunas) return { w: 0, resto: 0, comExtra: false, cabeca: nivel, mostrar: n }
  }
  let k = n
  while (k > 0 && 2 + soma(k) > colunas) k--
  return { w: 0, resto: 0, comExtra: false, cabeca: 'nada', mostrar: k }
}
