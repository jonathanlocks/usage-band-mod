// usage-band-mod: banda de uma linha acima do prompt com modelo, custo e barras de contexto,
// sessão de 5 horas, semana e limite por modelo; no Mac e no Windows, uma janela de ajustes.
// Tudo o que chama $ mora neste arquivo: motores mais antigos do Claude Code (o 2.1.295 que vem no
// app desktop) recusam o módulo inteiro quando $ é passado a uma função importada de outro arquivo.
// ./fontes, ./janela e ./prefs trazem só a parte pura; os desenhos vêm de ./ui.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, ProcessSpawnResult, Register } from 'claude-code'

import type { Cambio, Leitura, LeituraModelos, Moeda, Preferencias } from '../types'
import {
  CAMBIO_URL,
  CHAVE_CAMBIO,
  CHAVE_MODELOS,
  INTERVALO_MODELOS,
  TRAVA,
  USO_URL,
  VALIDADE_CAMBIO,
  cambioValido,
  lerCambio,
  lerModelos,
  modelosValidos,
  montarLeitura,
  proximaTentativa,
  silencio,
} from './fontes'
import type { Uso } from './fontes'
import { CAMPOS, CHAVE_AJUSTE, PRAZO_PRONTO, amostra, caminhoDoApp, lerLinha, pendenteValido, situacao, temDotNet48 } from './janela'
import type { Abertura, Pendente, Plataforma } from './janela'
import { deOpcoes, iguais } from './prefs'
import { textos } from './textos'
import { banda } from './ui'
import type { Contexto } from './ui'

const leitura = atom({ plugin: 'usage-band-mod', key: 'leitura' } as const, null)
const modelos = atom({ plugin: 'usage-band-mod', key: 'modelos' } as const, null)
const cambio = atom({ plugin: 'usage-band-mod', key: 'cambio' } as const, null)
const ajuste = atom({ plugin: 'usage-band-mod', key: 'ajuste' } as const, null)
const oculta = atom({ plugin: 'usage-band-mod', key: 'oculta' } as const, false)
const relogio = atom({ plugin: 'usage-band-mod', key: 'relogio' } as const, 0)
const CHAVE_OCULTA = 'oculta'

async function silencioDeRede($: EngineInterface): Promise<boolean> {
  return silencio(await $.env.get('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'))
}

// ---------- uso da sessão ----------

// Grava só quando algo mudou: cada gravação redesenha a banda.
async function guardarLeitura($: EngineInterface, nova: Leitura): Promise<void> {
  const atual = await read($, leitura)
  if (atual !== null && JSON.stringify(atual) === JSON.stringify(nova)) return
  await update($, leitura, () => nova)
}

async function medir($: EngineInterface, uso?: Uso): Promise<void> {
  try {
    const u = uso ?? (await $.session.usage())
    const nova = montarLeitura(u, await $.session.model())
    await guardarLeitura($, nova)
  } catch {
    // Sem leitura agora; mantém a última.
  }
}

// ---------- limite por modelo ----------

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
async function medirModelos($: EngineInterface, idadeMax = INTERVALO_MODELOS): Promise<void> {
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

let cotandoDesde = 0

async function medirCambio($: EngineInterface, moeda: Moeda): Promise<void> {
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

// ---------- preferências e janela de ajustes ----------

// Preferências em vigor: o ajuste da janela, se houver, senão o userConfig.
async function emVigor($: EngineInterface, opcoes: Preferencias): Promise<Preferencias> {
  return (await read($, ajuste)) ?? opcoes
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
async function conciliar($: EngineInterface, opcoes: Preferencias): Promise<void> {
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

async function janelaDisponivel($: EngineInterface): Promise<boolean> {
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

let aberta = false

// Abre a janela e fica escutando até ela fechar. Só diz "aberta" depois do {"pronto":true} do app.
async function abrirJanela($: EngineInterface, opcoes: Preferencias): Promise<{ resultado: Abertura; detalhe: string }> {
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
  const estado = { prefs, amostra: amostra(await read($, leitura), await read($, modelos), await read($, cambio)) }
  const argv = [caminhoDoApp($.plugin.root, plataforma), '--estado', JSON.stringify(estado)]
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

// ---------- banda e comandos ----------

async function contexto($: EngineInterface, opcoes: Preferencias): Promise<Contexto | null> {
  const l = await read($, leitura)
  if (l === null) return null
  const prefs = await emVigor($, opcoes)
  const c = await read($, cambio)
  const agora = await $.clock.now()
  const recente = c !== null && c.lidoEm !== null && agora - c.lidoEm < VALIDADE_CAMBIO
  const taxa = prefs.moeda === 'USD' || !recente ? null : (c.taxas[prefs.moeda] ?? null)
  return { l, prefs, modelos: await read($, modelos), taxa, agora }
}

async function buscar($: EngineInterface, opcoes: Preferencias): Promise<void> {
  const prefs = await emVigor($, opcoes)
  if (prefs.limitePorModelo) void medirModelos($)
  void medirCambio($, prefs.moeda)
}

async function ocultar($: EngineInterface, valor: boolean): Promise<void> {
  await update($, oculta, () => valor)
  await $.store.set(CHAVE_OCULTA, valor)
}

// O que dizer quando a janela não abriu. No Windows, um app que não sobe costuma ser o exe barrado
// (sem assinatura digital): a mensagem diz isso e aponta o /config.
async function falha($: EngineInterface, opcoes: Preferencias, detalhe: string): Promise<string> {
  const t = textos((await emVigor($, opcoes)).idioma)
  if (detalhe === '') return t.janelaIndisponivel
  return plataforma === 'windows' ? t.janelaBloqueada(detalhe) : t.janelaFalhou(detalhe)
}

async function ajustes($: EngineInterface, opcoes: Preferencias): Promise<{ text: string }> {
  const r = await abrirJanela($, opcoes)
  if (r.resultado === 'falhou') return { text: await falha($, opcoes, r.detalhe) }
  return { text: textos((await emVigor($, opcoes)).idioma).janelaAberta }
}

// O ⚙ da banda não tem onde responder como um comando: se a janela não abrir, o motivo vai num aviso.
async function ajustesPeloBotao($: EngineInterface, opcoes: Preferencias): Promise<void> {
  const r = await abrirJanela($, opcoes)
  if (r.resultado === 'falhou') $.ui.toast(await falha($, opcoes, r.detalhe), { timeoutMs: 12_000 })
}

async function alternarBanda($: EngineInterface, opcoes: Preferencias): Promise<{ text: string }> {
  const t = textos((await emVigor($, opcoes)).idioma)
  const escondida = !(await read($, oculta))
  await ocultar($, escondida)
  return { text: escondida ? t.bandaOculta : t.bandaVisivel }
}

async function iniciar($: EngineInterface, opcoes: Preferencias): Promise<void> {
  await conciliar($, opcoes)
  const prefs = await emVigor($, opcoes)
  const t = textos(prefs.idioma)
  // Nomes escritos por extenso: o validador reconhece assim que cada comando é deste mod.
  if (prefs.idioma === 'pt') {
    await $.command.register({ name: 'uso-barra', description: t.cmdBanda })
    await $.command.register({ name: 'uso-ajustes', description: t.cmdAjustes })
  } else {
    await $.command.register({ name: 'usage-band', description: t.cmdBanda })
    await $.command.register({ name: 'usage-settings', description: t.cmdAjustes })
  }
  if ((await $.store.get(CHAVE_OCULTA)) === true) await update($, oculta, () => true)
  await medir($)
  await buscar($, opcoes)
  void janelaDisponivel($)
}

// A cada minuto: os relógios de "reinicia em" andam, e as fontes conferem se já é hora de ler.
async function aCadaMinuto($: EngineInterface, opcoes: Preferencias): Promise<void> {
  await update($, relogio, n => (n ?? 0) + 1)
  await medir($)
  await buscar($, opcoes)
}

export const register: Register = (on, options) => {
  const opcoes = deOpcoes(options)

  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await iniciar($, opcoes)
    $.clock.every(60_000, () => aCadaMinuto($, opcoes))
    return ran
  })

  // O evento já traz os números: nada de pedir de novo.
  on('session.measure', async ($, e, next) => {
    const ran = await next(e)
    await medir($, e)
    return ran
  })

  on('command.run', { command: 'uso-barra' }, async $ => alternarBanda($, opcoes))
  on('command.run', { command: 'usage-band' }, async $ => alternarBanda($, opcoes))
  on('command.run', { command: 'uso-ajustes' }, async $ => ajustes($, opcoes))
  on('command.run', { command: 'usage-settings' }, async $ => ajustes($, opcoes))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await contexto($, opcoes)
    if (e.props.hasSurvey || c === null || (await read($, oculta))) return next(e)
    await read($, relogio)
    await read($, ajuste)
    const ui = $.ui.resolve(e)
    const outros = await next(e)
    return banda(ui, e.surface, e.props.bodyColumns, c, {
      ocultar: () => ocultar($, true),
      ajustes: e.surface === 'desktop' && disponivel === true ? () => ajustesPeloBotao($, opcoes) : undefined,
    }, outros)
  })
}
