// Janela de ajustes: no Mac um app SwiftUI (macos/), no Windows um app WPF (windows/), que o mod
// abre e escuta. Os dois falam o mesmo protocolo.
// Conversa por linhas JSON: o app escreve {"pronto": true} ao aparecer, {"prefs": {...}} a cada
// mudança e {"fim": true} ao fechar. As mudanças valem na hora (átomo `ajuste`); ao fechar, vão
// para o userConfig por $.config.set, para que o menu /config e as próximas sessões vejam o mesmo.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, ProcessSpawnResult } from 'claude-code'

import type { Preferencias } from '../types'
import { iguais, preferencias } from './prefs'

export const ajuste = atom({ plugin: 'usage-band-mod', key: 'ajuste' } as const, null)
const leitura = atom({ plugin: 'usage-band-mod', key: 'leitura' } as const, null)
const modelos = atom({ plugin: 'usage-band-mod', key: 'modelos' } as const, null)
const cambio = atom({ plugin: 'usage-band-mod', key: 'cambio' } as const, null)

const CHAVE_AJUSTE = 'ajuste'
const CAMPOS = ['idioma', 'moeda', 'mascote', 'limitePorModelo'] as const

// Onde a janela mora em cada sistema.
export type Plataforma = 'macos' | 'windows'

// No Windows a raiz pode vir com `\` ou `/`: o caminho do exe usa o mesmo separador que ela.
export function caminhoDoApp(raiz: string, p: Plataforma = 'macos'): string {
  const pasta = raiz.replace(/[\\/]\.claude-plugin[\\/]?$/, '').replace(/[\\/]$/, '')
  if (p === 'windows') {
    const sep = pasta.includes('\\') ? '\\' : '/'
    return [pasta, 'windows', 'PainelDeUso.exe'].join(sep)
  }
  return `${pasta}/macos/PainelDeUso.app/Contents/MacOS/PainelDeUso`
}

// Saída de `reg.exe query ...\NDP\v4\Full /v Release`: tem .NET Framework 4.8 (528040) ou mais novo?
export function temDotNet48(saidaDoReg: string): boolean {
  const m = /\bRelease\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(saidaDoReg)
  return m !== null && parseInt(m[1] ?? '', 16) >= 528040
}

// Uma linha do app: só aceita preferências válidas; o resto é ignorado.
export function lerLinha(linha: string, base: Preferencias): { prefs?: Preferencias; fim?: true; pronto?: true } {
  try {
    // trim: no Windows a linha pode chegar com um \r sobrando.
    const o = JSON.parse(linha.trim()) as Record<string, unknown>
    if (o.pronto === true) return { pronto: true }
    if (o.fim === true) return { fim: true }
    if (typeof o.prefs === 'object' && o.prefs !== null) return { prefs: preferencias(o.prefs, base) }
  } catch {
    // Linha que não é JSON (log do app): ignora.
  }
  return {}
}

// Preferências em vigor: o ajuste da janela, se houver, senão o userConfig.
export async function emVigor($: EngineInterface, opcoes: Preferencias): Promise<Preferencias> {
  return (await read($, ajuste)) ?? opcoes
}

// Gravação no userConfig. Cada $.config.set pode recarregar o mod no meio do caminho, então o
// pedido inteiro fica antes no $.store ({ prefs, base }) e cada carga aplica o que falta.
// `aplicado`: tudo já foi gravado sem recarga; daí em diante, uma mudança no /config vence.
type Pendente = { prefs: Preferencias; base: Preferencias; recusado: boolean; aplicado: boolean }

function pendenteValido(v: unknown): Pendente | null {
  if (typeof v !== 'object' || v === null) return null
  const g = v as { prefs?: unknown; base?: unknown; recusado?: unknown; aplicado?: unknown }
  if (typeof g.prefs !== 'object' || typeof g.base !== 'object') return null
  return { prefs: preferencias(g.prefs), base: preferencias(g.base), recusado: g.recusado === true, aplicado: g.aplicado === true }
}

// O que fazer com um pedido pendente diante do userConfig atual:
// - 'pronto': tudo já está gravado;
// - 'descartar': alguém mexeu no /config por fora, e o menu vence;
// - 'continuar': ainda há campos a gravar (ou o /config recusou, e o ajuste fica valendo).
export function situacao(p: Pendente, opcoes: Preferencias): 'pronto' | 'descartar' | 'continuar' {
  if (iguais(p.prefs, opcoes)) return 'pronto'
  for (const campo of CAMPOS) {
    if (opcoes[campo] !== p.base[campo] && opcoes[campo] !== p.prefs[campo]) return 'descartar'
  }
  // Já gravado e o /config voltou um campo ao valor antigo: foi a pessoa, e o menu vence.
  return p.aplicado ? 'descartar' : 'continuar'
}

async function aplicar($: EngineInterface, p: Pendente, opcoes: Preferencias): Promise<void> {
  for (const campo of CAMPOS) {
    if (p.prefs[campo] === opcoes[campo]) continue
    let recusado = false
    try {
      const r = await $.config.set({ key: `usage-band-mod.${campo}`, value: p.prefs[campo] })
      recusado = 'deny' in r && r.deny !== undefined
    } catch {
      recusado = true
    }
    if (recusado) {
      await $.store.set(CHAVE_AJUSTE, { ...p, recusado: true })
      return
    }
  }
  // Chegou aqui sem recarga: tudo gravado. O pedido fica marcado para a próxima carga só limpar.
  await $.store.set(CHAVE_AJUSTE, { ...p, aplicado: true })
}

// Ao carregar: conclui, retoma ou descarta o pedido guardado.
export async function conciliar($: EngineInterface, opcoes: Preferencias): Promise<void> {
  const p = pendenteValido(await $.store.get(CHAVE_AJUSTE))
  if (p === null) {
    const atual = await read($, ajuste)
    if (atual !== null && iguais(atual, opcoes)) await update($, ajuste, () => null)
    return
  }
  const s = situacao(p, opcoes)
  if (s !== 'continuar') {
    await $.store.delete(CHAVE_AJUSTE)
    await update($, ajuste, () => null)
    return
  }
  await update($, ajuste, () => p.prefs)
  if (!p.recusado) await aplicar($, p, opcoes)
}

async function gravar($: EngineInterface, prefs: Preferencias, opcoes: Preferencias): Promise<void> {
  if (iguais(prefs, opcoes)) {
    // Voltou tudo ao que o /config já tem (por exemplo, desfez uma mudança recusada): nada pendente.
    await $.store.delete(CHAVE_AJUSTE)
    await update($, ajuste, () => null)
    return
  }
  const p: Pendente = { prefs, base: opcoes, recusado: false, aplicado: false }
  await $.store.set(CHAVE_AJUSTE, p)
  await aplicar($, p, opcoes)
}

// A janela precisa do macOS 26, ou do Windows com .NET Framework 4.8. Descoberto uma vez por carga:
// o ⚙ da banda só aparece com ela. A API não diz o sistema; a variável OS é fixa no Windows.
let plataforma: Plataforma = 'macos'
let disponivel: boolean | null = null

export async function janelaDisponivel($: EngineInterface): Promise<boolean> {
  if (disponivel !== null) return disponivel
  try {
    if ((await $.env.get('OS')) === 'Windows_NT') {
      plataforma = 'windows'
      const r = await $.process.run(
        ['reg.exe', 'query', 'HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full', '/v', 'Release'],
        { timeoutMs: 5_000 },
      )
      disponivel = r.exitCode === 0 && temDotNet48(r.stdout)
    } else {
      const r = await $.process.run(['/usr/bin/sw_vers', '-productVersion'], { timeoutMs: 5_000 })
      disponivel = r.exitCode === 0 && Number(r.stdout.trim().split('.')[0]) >= 26
    }
  } catch {
    disponivel = false
  }
  return disponivel
}

export const jaSabeDisponivel = (): boolean => disponivel === true
export const plataformaDaJanela = (): Plataforma => plataforma

let aberta = false

// Quanto esperar o app dizer {"pronto":true} antes de desistir.
const PRAZO_PRONTO = 15_000

export type Abertura = 'aberta' | 'ja-aberta' | 'falhou'

// Abre a janela e fica escutando até ela fechar. Só diz "aberta" depois do {"pronto":true} do app.
export async function abrirJanela($: EngineInterface, opcoes: Preferencias): Promise<{ resultado: Abertura; detalhe: string }> {
  if (aberta) return { resultado: 'ja-aberta', detalhe: '' }
  // A trava liga antes de qualquer espera: um clique duplo no ⚙ não abre duas janelas.
  aberta = true
  try {
    return await abrir($, opcoes)
  } catch (erro) {
    aberta = false
    return { resultado: 'falhou', detalhe: erro instanceof Error ? erro.message.slice(0, 120) : '' }
  }
}

async function abrir($: EngineInterface, opcoes: Preferencias): Promise<{ resultado: Abertura; detalhe: string }> {
  if (!(await janelaDisponivel($))) {
    aberta = false
    return { resultado: 'falhou', detalhe: '' }
  }
  const prefs = await emVigor($, opcoes)
  const l = await read($, leitura)
  const m = await read($, modelos)
  const c = await read($, cambio)
  const amostra = {
    modelo: l?.modelo ?? 'Opus 5.5',
    usd: l?.usd ?? 3.26,
    contexto: l?.pct ?? 24,
    cincoHoras: l?.limites.find(x => x.tipo === 'five_hour')?.pct ?? 5,
    semana: l?.limites.find(x => x.tipo === 'seven_day')?.pct ?? 1,
    porModelo: (m?.limites ?? []).map(x => ({ modelo: x.modelo, pct: x.pct ?? 0 })),
    taxas: c?.taxas ?? {},
  }
  const argv = [caminhoDoApp($.plugin.root, plataforma), '--estado', JSON.stringify({ prefs, amostra })]
  const iterador = $.process.spawn({ argv })[Symbol.asyncIterator]()

  let resto = ''
  let erros = ''
  let ultima: Preferencias = prefs
  // Depois de desistir de um app que não respondeu, nada do que ele mandar vale mais.
  let desistiu = false
  // Trata um pedaço da saída; devolve true quando chega o "pronto".
  const tratar = async (pedaco: { stream: string; text: string }): Promise<boolean> => {
    if (desistiu) return false
    if (pedaco.stream !== 'stdout') {
      erros = (erros + pedaco.text).slice(-200)
      return false
    }
    resto += pedaco.text
    const linhas = resto.split('\n')
    resto = linhas.pop() ?? ''
    let pronto = false
    for (const linha of linhas) {
      const lida = lerLinha(linha, ultima)
      if (lida.pronto === true) pronto = true
      if (lida.prefs !== undefined) {
        ultima = lida.prefs
        await update($, ajuste, () => lida.prefs ?? null)
      }
    }
    return pronto
  }

  const esperarPronto = async (): Promise<'pronto' | string> => {
    for (;;) {
      const r = await iterador.next()
      if (r.done === true) return (erros.trim().split('\n').pop() ?? '') || 'o app fechou antes de abrir a janela'
      if (await tratar(r.value)) return 'pronto'
    }
  }
  let resposta: string
  try {
    resposta = await Promise.race([esperarPronto(), $.clock.sleep(PRAZO_PRONTO).then(() => 'o app não respondeu')])
  } catch (erro) {
    resposta = erro instanceof Error ? erro.message.slice(0, 120) : ''
  }
  if (resposta !== 'pronto') {
    desistiu = true
    // Encerrar o laço encerra o app, se ele ainda estiver de pé. Sem esperar: ele pode estar travado.
    void iterador.return?.({ code: null, signal: null } as unknown as ProcessSpawnResult)
    aberta = false
    return { resultado: 'falhou', detalhe: resposta }
  }

  void (async () => {
    try {
      for (let r = await iterador.next(); r.done !== true; r = await iterador.next()) await tratar(r.value)
    } catch {
      // O app caiu: o que ele já mandou continua valendo.
    } finally {
      aberta = false
      await gravar($, ultima, opcoes)
    }
  })()
  return { resultado: 'aberta', detalhe: '' }
}
