// usage-band-mod: banda de uma linha acima do prompt com modelo, custo e barras de contexto,
// sessão de 5 horas, semana e limite por modelo; no Mac e no Windows, uma janela de ajustes.
// Os números vêm de ./fontes; os desenhos, de ./ui; as preferências, de ./prefs e ./janela.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Preferencias } from '../types'
import { VALIDADE_CAMBIO, medir, medirCambio, medirModelos } from './fontes'
import { abrirJanela, conciliar, emVigor, jaSabeDisponivel, janelaDisponivel, plataformaDaJanela } from './janela'
import { deOpcoes } from './prefs'
import { textos } from './textos'
import { banda } from './ui'
import type { Contexto } from './ui'

// Átomos que este arquivo lê (o validador pede a referência escrita aqui; os mesmos de ./fontes e ./janela).
const leitura = atom({ plugin: 'usage-band-mod', key: 'leitura' } as const, null)
const modelos = atom({ plugin: 'usage-band-mod', key: 'modelos' } as const, null)
const cambio = atom({ plugin: 'usage-band-mod', key: 'cambio' } as const, null)
const ajuste = atom({ plugin: 'usage-band-mod', key: 'ajuste' } as const, null)
const oculta = atom({ plugin: 'usage-band-mod', key: 'oculta' } as const, false)
const relogio = atom({ plugin: 'usage-band-mod', key: 'relogio' } as const, 0)
const CHAVE_OCULTA = 'oculta'

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
  return plataformaDaJanela() === 'windows' ? t.janelaBloqueada(detalhe) : t.janelaFalhou(detalhe)
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
      ajustes: e.surface === 'desktop' && jaSabeDisponivel() ? () => ajustesPeloBotao($, opcoes) : undefined,
    }, outros)
  })
}
