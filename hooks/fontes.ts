// De onde vêm os números.
// - Uso da sessão: $.session.usage() e o evento session.measure (os mesmos da status line, grátis).
// - Limite semanal por modelo (ex.: Fable): endpoint interno da Anthropic, sem documentação pública.
//   Só é lido com a opção ligada; o host anexa o login e o mod nunca vê o token.
// - Câmbio: taxas públicas da Coinbase a partir do dólar, só quando a moeda não é USD.
// Nenhuma consulta sai com CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ligada.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, SessionUsage } from 'claude-code'

import type { Cambio, Leitura, LeituraModelos, LimiteModelo, Moeda } from '../types'
import { nomeBonito } from './formato'

export const leitura = atom({ plugin: 'usage-band-mod', key: 'leitura' } as const, null)
export const modelos = atom({ plugin: 'usage-band-mod', key: 'modelos' } as const, null)
export const cambio = atom({ plugin: 'usage-band-mod', key: 'cambio' } as const, null)

const USO_URL = 'https://api.anthropic.com/api/oauth/usage'
const CAMBIO_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
const CHAVE_MODELOS = 'modelos'
const CHAVE_CAMBIO = 'cambio'
export const INTERVALO_MODELOS = 600_000
export const VALIDADE_MODELOS = 3_600_000
export const INTERVALO_CAMBIO = 21_600_000
// Uma cotação mais velha que isso não é usada: o custo volta a aparecer em dólar.
export const VALIDADE_CAMBIO = 259_200_000
// Espera depois de falhas seguidas: 5 min, 30 min, 2 h e daí em diante.
export const ESPERAS = [300_000, 1_800_000, 7_200_000]
// Uma consulta presa há mais que isso não segura a próxima.
const TRAVA = 60_000

const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null

export async function silencioDeRede($: EngineInterface): Promise<boolean> {
  const v = await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false'
}

// ---------- uso da sessão ----------

type Uso = Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>

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

// Grava só quando algo mudou: cada gravação redesenha a banda.
export async function guardarLeitura($: EngineInterface, nova: Leitura): Promise<void> {
  const atual = await read($, leitura)
  if (atual !== null && JSON.stringify(atual) === JSON.stringify(nova)) return
  await update($, leitura, () => nova)
}

export async function medir($: EngineInterface, uso?: Uso): Promise<void> {
  try {
    const u = uso ?? (await $.session.usage())
    const nova = montarLeitura(u, await $.session.model())
    await guardarLeitura($, nova)
  } catch {
    // Sem leitura agora; mantém a última.
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

async function buscarModelos($: EngineInterface, agora: number): Promise<LeituraModelos> {
  const falha = (estado: LeituraModelos['estado'], detalhe: string): LeituraModelos => ({ em: agora, lidoEm: null, estado, detalhe, limites: [] })
  try {
    const cred = await $.session.authorize()
    if (cred === null || cred.kind !== 'bearer') return falha('sem-credencial', '')
    const r = await $.http.fetch(USO_URL, { auth: cred.handle, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
    if (!r.ok) return falha('recusado', String(r.status))
    return { em: agora, lidoEm: agora, estado: 'ok', detalhe: '', limites: lerModelos(r.text) }
  } catch (erro) {
    return falha('erro', erro instanceof Error ? erro.message.slice(0, 120) : '')
  }
}

let buscandoDesde = 0

// No máximo uma leitura por `idadeMax`, contando todas as sessões abertas (a leitura fica no $.store).
export async function medirModelos($: EngineInterface, idadeMax = INTERVALO_MODELOS): Promise<void> {
  const agora = await $.clock.now()
  if (agora - buscandoDesde < TRAVA) return
  buscandoDesde = agora
  try {
    const recente = (m: LeituraModelos | null): boolean => m !== null && agora - m.em < idadeMax
    const naMemoria = await read($, modelos)
    if (recente(naMemoria) && naMemoria?.estado === 'ok') return
    // Depois de uma falha desta sessão, o store ainda pode trazer a leitura que outra sessão acabou de fazer.
    const guardada = modelosValidos(await $.store.get(CHAVE_MODELOS))
    if (guardada !== null && recente(guardada)) {
      if (JSON.stringify(guardada) !== JSON.stringify(naMemoria)) await update($, modelos, () => guardada)
      return
    }
    // A falha recente desta sessão segura a próxima tentativa, mesmo sem nada no store.
    if (recente(naMemoria)) return
    if (await silencioDeRede($)) return
    const nova = await buscarModelos($, agora)
    // Uma falha guarda o motivo, mas não apaga os últimos números lidos.
    const final = nova.estado === 'ok' || guardada === null ? nova : { ...nova, lidoEm: guardada.lidoEm, limites: guardada.limites }
    await $.store.set(CHAVE_MODELOS, final)
    await update($, modelos, () => final)
  } catch {
    // Sem leitura agora; mantém a última.
  } finally {
    buscandoDesde = 0
  }
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

let cotandoDesde = 0

export async function medirCambio($: EngineInterface, moeda: Moeda): Promise<void> {
  if (moeda === 'USD') return
  const agora = await $.clock.now()
  if (agora - cotandoDesde < TRAVA) return
  cotandoDesde = agora
  try {
    const naMemoria = await read($, cambio)
    if (naMemoria !== null && agora < proximaTentativa(naMemoria)) return
    const guardado = cambioValido(await $.store.get(CHAVE_CAMBIO))
    if (guardado !== null && agora < proximaTentativa(guardado)) {
      await update($, cambio, () => guardado)
      return
    }
    if (await silencioDeRede($)) return
    let taxas: Partial<Record<Moeda, number>> = {}
    try {
      const r = await $.http.fetch(CAMBIO_URL)
      taxas = r.ok ? lerCambio(r.text) : {}
    } catch {
      taxas = {}
    }
    const deuCerto = Object.keys(taxas).length > 0
    // A falha também é gravada, com a hora da tentativa: é ela que segura a próxima.
    const final: Cambio = deuCerto
      ? { em: agora, lidoEm: agora, falhas: 0, taxas }
      : { em: agora, lidoEm: guardado?.lidoEm ?? null, falhas: (guardado?.falhas ?? 0) + 1, taxas: guardado?.taxas ?? {} }
    await $.store.set(CHAVE_CAMBIO, final)
    await update($, cambio, () => final)
  } catch {
    // Sem câmbio agora; mantém o último.
  } finally {
    cotandoDesde = 0
  }
}
