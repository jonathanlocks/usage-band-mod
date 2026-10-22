// De onde vêm os números.
// - Uso da sessão: $.session.usage() e o evento session.measure (os mesmos da status line, grátis).
// - Limite semanal por modelo (ex.: Fable): endpoint interno da Anthropic, sem documentação pública.
//   Só é lido com a opção ligada; o host anexa o login e o mod nunca vê o token.
// - Câmbio: taxas públicas da Coinbase a partir do dólar, só quando a moeda não é USD.
// Nenhuma consulta sai com CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ligada.
// Aqui só a parte pura (endereços, prazos e leitura dos corpos); o que chama $ fica em ./register:
// motores mais antigos do Claude Code (o 2.1.295 do app desktop) não aceitam $ passado entre arquivos.
import type { SessionUsage } from 'claude-code'

import type { Cambio, Leitura, LeituraModelos, LimiteModelo, Moeda } from '../types'
import { nomeBonito } from './formato'

export const USO_URL = 'https://api.anthropic.com/api/oauth/usage'
export const CAMBIO_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
export const CHAVE_MODELOS = 'modelos'
export const CHAVE_CAMBIO = 'cambio'
export const INTERVALO_MODELOS = 600_000
export const VALIDADE_MODELOS = 3_600_000
export const INTERVALO_CAMBIO = 21_600_000
// Uma cotação mais velha que isso não é usada: o custo volta a aparecer em dólar.
export const VALIDADE_CAMBIO = 259_200_000
// Espera depois de falhas seguidas: 5 min, 30 min, 2 h e daí em diante.
export const ESPERAS = [300_000, 1_800_000, 7_200_000]
// Uma consulta presa há mais que isso não segura a próxima.
export const TRAVA = 60_000

const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null

// Valor de CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: ligada, nenhuma consulta sai.
export function silencio(v: string | undefined): boolean {
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
}

// ---------- uso da sessão ----------

export type Uso = Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>

export function montarLeitura(uso: Uso, modelo: string): Leitura {
  return {
    modelo: nomeBonito(modelo),
    pct: uso.context.percent ?? null,
    tokens: uso.context.tokens ?? null,
    janela: uso.context.window,
    usd: uso.cost?.usd ?? null,
    limites: uso.rateLimits.map(r => ({ tipo: r.kind, pct: r.percentUsed ?? null, reinicia: r.resetsAt ?? null })),
  }
}

// ---------- limite por modelo ----------

// Linhas `weekly_scoped` com modelo, do corpo do endpoint. Lança se o corpo não é JSON.
export function lerModelos(texto: string): LimiteModelo[] {
  const linhas = objeto(JSON.parse(texto))?.limits
  if (!Array.isArray(linhas)) return []
  const saida: LimiteModelo[] = []
  for (const bruta of linhas) {
    const linha = objeto(bruta)
    const nome = objeto(objeto(linha?.scope)?.model)?.display_name
    if (linha === null || linha.kind !== 'weekly_scoped' || typeof nome !== 'string') continue
    const r = linha.resets_at
    saida.push({
      modelo: nome,
      pct: typeof linha.percent === 'number' ? linha.percent : null,
      reinicia: typeof r === 'number' ? new Date(r * 1000).toISOString() : typeof r === 'string' ? r : null,
    })
  }
  return saida
}

export function modelosValidos(v: unknown): LeituraModelos | null {
  const o = objeto(v)
  if (o === null || typeof o.em !== 'number' || typeof o.estado !== 'string' || typeof o.detalhe !== 'string' || !Array.isArray(o.limites)) return null
  if (!['ok', 'sem-credencial', 'recusado', 'erro'].includes(o.estado)) return null
  const limites: LimiteModelo[] = []
  for (const l of o.limites) {
    const x = objeto(l)
    if (x === null || typeof x.modelo !== 'string') continue
    limites.push({ modelo: x.modelo, pct: typeof x.pct === 'number' ? x.pct : null, reinicia: typeof x.reinicia === 'string' ? x.reinicia : null })
  }
  return { em: o.em, lidoEm: typeof o.lidoEm === 'number' ? o.lidoEm : null, estado: o.estado as LeituraModelos['estado'], detalhe: o.detalhe, limites }
}

// ---------- câmbio ----------

const MOEDAS_CAMBIO: readonly Moeda[] = ['BRL', 'EUR']

// Taxas a partir do dólar no corpo da Coinbase ({ data: { rates: { BRL: "5.41", ... } } }).
// Lança se o corpo não é JSON; objeto vazio se não acha nenhuma.
export function lerCambio(texto: string): Partial<Record<Moeda, number>> {
  const taxas = objeto(objeto(objeto(JSON.parse(texto))?.data)?.rates)
  const saida: Partial<Record<Moeda, number>> = {}
  if (taxas === null) return saida
  for (const m of MOEDAS_CAMBIO) {
    const v = Number(taxas[m])
    if (Number.isFinite(v) && v > 0) saida[m] = v
  }
  return saida
}

export function cambioValido(v: unknown): Cambio | null {
  const o = objeto(v)
  if (o === null || typeof o.em !== 'number' || typeof o.falhas !== 'number') return null
  const taxas: Partial<Record<Moeda, number>> = {}
  const t = objeto(o.taxas)
  for (const m of MOEDAS_CAMBIO) {
    const x = t?.[m]
    if (typeof x === 'number' && x > 0) taxas[m] = x
  }
  return { em: o.em, lidoEm: typeof o.lidoEm === 'number' ? o.lidoEm : null, falhas: Math.max(0, Math.floor(o.falhas)), taxas }
}

// Quando pode tentar de novo: 6 h depois de um sucesso; depois de falhas, a espera cresce.
export function proximaTentativa(c: Cambio): number {
  if (c.falhas === 0) return c.em + INTERVALO_CAMBIO
  return c.em + (ESPERAS[Math.min(c.falhas, ESPERAS.length) - 1] ?? INTERVALO_CAMBIO)
}
