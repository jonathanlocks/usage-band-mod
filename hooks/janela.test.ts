// Verificação das correções da janela: clique duplo, prazo, desfazer recusa, gravação retomável.
import { expect, mock, test } from 'claude-code/testing'
import type { On, ProcessSpawnChunk, ProcessSpawnResult, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'

type Fila = { push: (t: string) => void; fim: () => void }

function base(on: On, loja: Map<string, unknown>, sets: { key: string; value: unknown }[], negar: Set<string> = new Set()) {
  on('store.get', async (_$, e) => ({ value: loja.get(e.key) }))
  on('store.set', async (_$, e) => { loja.set(e.key, e.value); return { value: undefined } })
  on('store.delete', async (_$, e) => { loja.delete(e.key); return { value: undefined } })
  on('store.keys', async () => ({ value: [...loja.keys()] }))
  mock.env(on, {})
  on('config.set', async (_$, e) => {
    sets.push({ key: e.key, value: e.value })
    if (negar.has(e.key)) return { deny: 'não' }
    return { value: e.value }
  })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { window: 200_000, tokens: 1, percent: 1 }, rateLimits: [], cost: { usd: 1 } } as unknown as SessionUsage,
  }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.turns', async () => ({ value: 1 }))
  on('http.fetch', async () => ({ value: { status: 503, ok: false, headers: {}, text: '' } }))
  on('process.run', async () => ({ value: { exitCode: 0, stdout: '26.6\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
}

// Um app falso: o teste empurra linhas; conta quantos foram abertos.
function app(on: On, contador: { n: number }): Fila {
  const fila: (string | null)[] = []
  let acordar: (() => void) | null = null
  on('process.spawn', async function* (): AsyncGenerator<ProcessSpawnChunk, { value: ProcessSpawnResult }> {
    contador.n++
    for (;;) {
      while (fila.length === 0) await new Promise<void>(r => (acordar = r))
      const t = fila.shift()
      if (t === null || t === undefined) return { value: { code: 0, signal: null } }
      yield { stream: 'stdout', text: t }
    }
  })
  const mexer = () => { const a = acordar; acordar = null; a?.() }
  return { push: t => { fila.push(t); mexer() }, fim: () => { fila.push(null); mexer() } }
}

const comecar = ($: Engine) => $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
const OPC = { idioma: 'pt', moeda: 'USD', mascote: 'animado', limitePorModelo: false } as const

test('1. clique duplo: um só app, a segunda chamada diz ja-aberta', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const c = { n: 0 }; const f = app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  const b = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  f.push('{"pronto":true}\n')
  const [ra, rb] = await Promise.all([a, b])
  expect(c.n).toBe(1)
  expect(ra.text).toBe('Janela de ajustes aberta.')
  expect(rb.text).toBe('Janela de ajustes aberta.') // 'ja-aberta' não é 'falhou': mesmo texto
  // Depois de fechar, abre de novo.
  f.fim(); await relogio.settle()
  const d = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  f.push('{"pronto":true}\n')
  expect((await d).text).toBe('Janela de ajustes aberta.')
  expect(c.n).toBe(2)
})

test('2. prazo: sem pronto em 15 s, falha e a trava solta', { options: OPC, timeoutMs: 8000 }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const c = { n: 0 }; app(on, c)
  await comecar($)
  let pronto = false
  const a = $.command.run({ command: 'uso-ajustes' } as never).then(r => { pronto = true; return r })
  await relogio.advance(14_000)
  expect(pronto).toBe(false)
  await relogio.advance(1_500)
  const r = await a
  expect(r.text).toBe('Não deu para abrir a janela de ajustes (o app não respondeu). Use o /config.')
  // A trava voltou a false: um novo pedido gera um novo spawn.
  const b = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.advance(16_000)
  await b
  expect(c.n).toBe(2)
})

test('2b. app que sai antes do pronto: falha e solta a trava', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const c = { n: 0 }; const f = app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.fim()
  expect((await a).text).toBe('Não deu para abrir a janela de ajustes (o app fechou antes de abrir a janela). Use o /config.')
  const b = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n')
  expect((await b).text).toBe('Janela de ajustes aberta.')
  expect(c.n).toBe(2)
})

test('3. desfazer recusa: voltar ao userConfig limpa store e ajuste', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>([['ajuste', { prefs: { ...OPC, idioma: 'en' }, base: OPC, recusado: true }]])
  const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const f = app(on, { n: 0 })
  await comecar($)
  // Recusa guardada: o ajuste (inglês) vale, e nada é regravado.
  expect(sets.length).toBe(0)
  expect((await $.command.run({ command: 'uso-barra' } as never)).text).toBe('Usage band hidden.')
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n'); await a
  f.push(`{"prefs":${JSON.stringify(OPC)}}\n`); f.fim()
  await relogio.settle()
  expect(loja.has('ajuste')).toBe(false)
  expect(sets.length).toBe(0)
  // Átomo limpo: o texto volta ao idioma do userConfig.
  expect((await $.command.run({ command: 'uso-barra' } as never)).text).toMatch(/^Barra de uso/)
})

test('4a. dois campos, recarga depois do primeiro: retoma só o segundo', { options: { ...OPC, idioma: 'en' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000_000 })
  const alvo = { ...OPC, idioma: 'en', moeda: 'BRL' }
  // Pedido era pt→en e USD→BRL a partir de {pt, USD}; idioma já gravado antes da recarga.
  const loja = new Map<string, unknown>([['ajuste', { prefs: alvo, base: OPC, recusado: false }]])
  const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  await comecar($)
  expect(sets).toEqual([{ key: 'usage-band-mod.moeda', value: 'BRL' }])
})

test('4b. mudança no /config vence: descarta o pedido', { options: { ...OPC, moeda: 'EUR' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>([['ajuste', { prefs: { ...OPC, idioma: 'en', moeda: 'BRL' }, base: OPC, recusado: false }]])
  const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  await comecar($)
  expect(sets.length).toBe(0)
  expect(loja.has('ajuste')).toBe(false)
  expect((await $.command.run({ command: 'uso-barra' } as never)).text).toBe('Barra de uso escondida.')
})

test('4c. tudo já gravado: limpa o pedido', { options: { ...OPC, idioma: 'en', moeda: 'BRL' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>([['ajuste', { prefs: { ...OPC, idioma: 'en', moeda: 'BRL' }, base: OPC, recusado: false }]])
  const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  await comecar($)
  expect(sets.length).toBe(0)
  expect(loja.has('ajuste')).toBe(false)
})

test('4d. recusa no meio: guarda recusado e não insiste na recarga', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(['usage-band-mod.idioma']))
  const f = app(on, { n: 0 })
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n'); await a
  f.push(`{"prefs":${JSON.stringify({ ...OPC, idioma: 'en', moeda: 'BRL' })}}\n`); f.fim()
  await relogio.settle()
  expect(sets).toEqual([{ key: 'usage-band-mod.idioma', value: 'en' }])
  expect((loja.get('ajuste') as { recusado: boolean }).recusado).toBe(true)
})

test('4e. depois de gravar tudo sem recarga, o pedido fica no store?', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const f = app(on, { n: 0 })
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n'); await a
  f.push(`{"prefs":${JSON.stringify({ ...OPC, idioma: 'en' })}}\n`); f.fim()
  await relogio.settle()
  expect(sets.length).toBe(1)
  expect(loja.has('ajuste')).toBe(true) // fica até a próxima carga
})
