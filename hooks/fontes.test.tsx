import { expect, mock, test } from 'claude-code/testing'
import type { HttpResponse, On, RenderPropsOf, SessionStartInput, SessionUsage } from 'claude-code'

import { ESPERAS, INTERVALO_CAMBIO, INTERVALO_MODELOS, cambioValido, lerCambio, lerModelos, modelosValidos, proximaTentativa, silencio } from './fontes'

test('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: qualquer valor liga, menos vazio, 0 e false', () => {
  for (const v of ['1', 'true', 'yes', 'TRUE']) expect(silencio(v)).toBe(true)
  for (const v of [undefined, '', '0', 'false', 'False']) expect(silencio(v)).toBe(false)
})

test('lerModelos pega só as janelas semanais por modelo', () => {
  const corpo = JSON.stringify({
    limits: [
      { kind: 'session', percent: 12 },
      { kind: 'weekly_all', percent: 30, resets_at: 1791763200 },
      { kind: 'weekly_scoped', percent: 61.5, resets_at: 1791763200, scope: { model: { display_name: 'Fable' } } },
      { kind: 'weekly_scoped', percent: 5, resets_at: '2026-10-15T12:00:00Z', scope: { surface: { display_name: 'Cowork' } } },
    ],
  })
  expect(lerModelos(corpo)).toEqual([{ modelo: 'Fable', pct: 61.5, reinicia: new Date(1791763200 * 1000).toISOString() }])
  expect(lerModelos('{"five_hour":null}')).toEqual([])
  expect(lerModelos('[]')).toEqual([])
})

test('o que volta do $.store é conferido item a item', () => {
  expect(modelosValidos({ em: 1, lidoEm: 1, estado: 'ok', detalhe: '', limites: [{ modelo: 7 }, { modelo: 'Fable', pct: 3 }] }))
    .toEqual({ em: 1, lidoEm: 1, estado: 'ok', detalhe: '', limites: [{ modelo: 'Fable', pct: 3, reinicia: null }] })
  expect(modelosValidos({ em: 1, estado: 'qualquer', detalhe: '', limites: [] })).toBe(null)
  expect(cambioValido({ em: 1, falhas: 0, taxas: { BRL: 5.4, EUR: -1, XYZ: 2 } })).toEqual({ em: 1, lidoEm: null, falhas: 0, taxas: { BRL: 5.4 } })
})

test('lerCambio pega real e euro do corpo da Coinbase', () => {
  const corpo = JSON.stringify({ data: { currency: 'USD', rates: { BRL: '5.41', EUR: '0.92', BTC: '0.0000093', JPY: '150' } } })
  expect(lerCambio(corpo)).toEqual({ BRL: 5.41, EUR: 0.92 })
  expect(lerCambio('{"data":{}}')).toEqual({})
})

test('a espera cresce com as falhas e volta a 6 h depois de um sucesso', () => {
  expect(proximaTentativa({ em: 0, lidoEm: 0, falhas: 0, taxas: {} })).toBe(INTERVALO_CAMBIO)
  expect(proximaTentativa({ em: 0, lidoEm: null, falhas: 1, taxas: {} })).toBe(ESPERAS[0])
  expect(proximaTentativa({ em: 0, lidoEm: null, falhas: 2, taxas: {} })).toBe(ESPERAS[1])
  expect(proximaTentativa({ em: 0, lidoEm: null, falhas: 9, taxas: {} })).toBe(ESPERAS[2])
})

// O mod inteiro, de ponta a ponta: começa a sessão e deixa o relógio andar.
function sessao(on: On, rede: { chamadas: number; status: number }) {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { window: 200_000, tokens: 48_000, percent: 24 }, rateLimits: [], cost: { usd: 3.26 } } as unknown as SessionUsage,
  }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('http.fetch', async () => {
    rede.chamadas++
    return { value: { status: rede.status, ok: rede.status === 200, headers: {}, text: '{"data":{"rates":{"BRL":"5.4"}}}' } satisfies HttpResponse }
  })
}

test('sem rede e sem cache, o câmbio não é pedido a cada minuto', { options: { moeda: 'BRL', limitePorModelo: false } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  mock.store(on)
  mock.env(on, {})
  const rede = { chamadas: 0, status: 503 }
  sessao(on, rede)
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
  // A primeira leitura sai em segundo plano, logo depois do início.
  await relogio.advance(1_000)
  expect(rede.chamadas).toBe(1)
  for (let i = 0; i < 4; i++) await relogio.advance(60_000)
  expect(rede.chamadas).toBe(1)
  await relogio.advance(ESPERAS[0] ?? 0)
  expect(rede.chamadas).toBe(2)
})

test('em dólar, nada sai para a rede', { options: { moeda: 'USD', limitePorModelo: false } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  mock.store(on)
  mock.env(on, {})
  const rede = { chamadas: 0, status: 200 }
  sessao(on, rede)
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
  await relogio.advance(3_600_000)
  expect(rede.chamadas).toBe(0)
})

test('com silêncio de rede ligado, nada sai mesmo em outra moeda', { options: { moeda: 'EUR', limitePorModelo: true } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  mock.store(on)
  mock.env(on, { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' })
  const rede = { chamadas: 0, status: 200 }
  sessao(on, rede)
  on('session.authorize', async () => ({ value: null }))
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
  await relogio.advance(3_600_000)
  expect(rede.chamadas).toBe(0)
})

// Um $.store de verdade para várias sessões: o teste escreve nele como outra sessão escreveria.
function disco(on: On): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  on('store.get', async (_$, e) => ({ value: d[e.key] }))
  on('store.set', async (_$, e) => { d[e.key] = e.value; return { value: undefined } })
  on('store.delete', async (_$, e) => { delete d[e.key]; return { value: undefined } })
  on('store.keys', async () => ({ value: Object.keys(d) }))
  return d
}

const BANDA = { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 160 } as unknown as RenderPropsOf['AbovePrompt']

test('a falha da própria sessão não esconde o limite por modelo que outra sessão acabou de ler', { options: { moeda: 'USD', limitePorModelo: true } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const d = disco(on)
  mock.env(on, {})
  const rede = { chamadas: 0, status: 503 }
  sessao(on, rede)
  on('session.authorize', async () => ({ value: { handle: 'h', kind: 'bearer' } }))
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="vazio" />
  })
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
  await relogio.advance(1_000)
  // Esta sessão tentou e foi recusada: o motivo fica gravado, sem números.
  expect(modelosValidos(d.modelos)?.estado).toBe('recusado')
  expect(rede.chamadas).toBe(1)
  // Outra sessão aberta lê com sucesso e grava no mesmo store.
  const agora = relogio.now()
  d.modelos = { em: agora, lidoEm: agora, estado: 'ok', detalhe: '', limites: [{ modelo: 'Fable', pct: 13, reinicia: null }] }
  // No minuto seguinte a banda desta sessão já mostra o Fable, sem pedir de novo à rede.
  await relogio.advance(60_000)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA })
  expect(await ui.find({ type: 'Text', text: /Fable/ })).toBeDefined()
  expect(rede.chamadas).toBe(1)
})

test('depois de uma falha, a sessão espera o intervalo antes de pedir de novo', { options: { moeda: 'USD', limitePorModelo: true } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  disco(on)
  mock.env(on, {})
  const rede = { chamadas: 0, status: 503 }
  sessao(on, rede)
  on('session.authorize', async () => ({ value: { handle: 'h', kind: 'bearer' } }))
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
  await relogio.advance(1_000)
  for (let i = 0; i < 9; i++) await relogio.advance(60_000)
  expect(rede.chamadas).toBe(1)
  await relogio.advance(INTERVALO_MODELOS)
  expect(rede.chamadas).toBe(2)
})
