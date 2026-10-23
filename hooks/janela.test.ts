// Verificação das correções da janela: clique duplo, prazo, desfazer recusa, gravação retomável,
// e qual janela abre em cada sistema (Mac, Windows com e sem .NET 4.8, Linux).
import { expect, mock, test } from 'claude-code/testing'
import type { On, ProcessSpawnChunk, ProcessSpawnResult, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { textos } from './textos'

type Fila = { push: (t: string) => void; fim: () => void }
type Rodar = { exitCode: number; stdout: string } | 'lança'
// O sistema simulado: variáveis de ambiente e o que o process.run devolve (por padrão, um macOS 26.6).
type Sistema = { env?: Record<string, string>; run?: Rodar }

const MAC: Sistema = { env: {}, run: { exitCode: 0, stdout: '26.6\n' } }
const WINDOWS: Sistema = { env: { OS: 'Windows_NT' }, run: { exitCode: 0, stdout: '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full\r\n    Release    REG_DWORD    0x80ea8\r\n\r\n' } }

function base(on: On, loja: Map<string, unknown>, sets: { key: string; value: unknown }[], negar: Set<string> = new Set(), sistema: Sistema = MAC) {
  on('store.get', async (_$, e) => ({ value: loja.get(e.key) }))
  on('store.set', async (_$, e) => { loja.set(e.key, e.value); return { value: undefined } })
  on('store.delete', async (_$, e) => { loja.delete(e.key); return { value: undefined } })
  on('store.keys', async () => ({ value: [...loja.keys()] }))
  mock.env(on, sistema.env ?? {})
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
  on('http.fetch', async () => ({ value: { status: 503, ok: false, headers: {}, text: '' } }))
  const run = sistema.run ?? { exitCode: 0, stdout: '26.6\n' }
  on('process.run', async () => {
    if (run === 'lança') throw new Error('ENOENT: /usr/bin/sw_vers')
    return { value: { ...run, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

// Um app falso: o teste empurra linhas; conta quantos foram abertos e guarda o último argv.
function app(on: On, contador: { n: number; argv?: readonly string[] }): Fila {
  const fila: (string | null)[] = []
  let acordar: (() => void) | null = null
  on('process.spawn', async function* (_$, e): AsyncGenerator<ProcessSpawnChunk, { value: ProcessSpawnResult }> {
    contador.n++
    contador.argv = e.argv
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

test('1b. o store falha ao gravar depois que a janela fecha: nenhum erro solto, o ajuste vale e a janela abre de novo', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  let quebrado = false
  const loja = new (class extends Map<string, unknown> {
    override set(k: string, v: unknown): this {
      if (quebrado) throw new Error('disco cheio')
      return super.set(k, v)
    }
  })()
  const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  const c = { n: 0 }; const f = app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n'); await a
  f.push(`{"prefs":${JSON.stringify({ ...OPC, idioma: 'en' })}}\n`)
  await relogio.settle()
  quebrado = true
  f.fim(); await relogio.settle()
  quebrado = false
  // A escolha da janela continua valendo nesta sessão, mesmo sem ter sido gravada.
  expect(loja.has('ajuste')).toBe(false)
  expect((await $.command.run({ command: 'uso-barra' } as never)).text).toBe('Usage band hidden.')
  const d = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle(); f.push('{"pronto":true}\n')
  expect((await d).text).toBe('Settings window open.')
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

test('5. Windows com .NET 4.8: abre windows\\PainelDeUso.exe', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(), WINDOWS)
  const c: { n: number; argv?: readonly string[] } = { n: 0 }; const f = app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  // O app do Windows termina as linhas com \r\n se alguém mudar o NewLine: continua valendo.
  f.push('{"pronto":true}\r\n')
  expect((await a).text).toBe('Janela de ajustes aberta.')
  expect(c.n).toBe(1)
  const argv = c.argv ?? []
  expect(argv[0]).toMatch(/[\\/]windows[\\/]PainelDeUso\.exe$/)
  expect(argv[1]).toBe('--estado')
  expect((JSON.parse(argv[2] ?? '{}') as { prefs: { idioma: string } }).prefs.idioma).toBe('pt')
  f.fim(); await relogio.settle()
})

test('6. Windows sem .NET 4.8: falha com a mensagem de indisponível', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(), { env: { OS: 'Windows_NT' }, run: { exitCode: 1, stdout: '' } })
  const c = { n: 0 }; app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  expect((await a).text).toBe(textos('pt').janelaIndisponivel)
  expect(c.n).toBe(0)
})

test('7. Linux: sem OS e sem sw_vers, a janela não existe', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(), { env: {}, run: 'lança' })
  const c = { n: 0 }; app(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  expect((await a).text).toBe(textos('pt').janelaIndisponivel)
  expect(c.n).toBe(0)
})

// Um exe barrado (Smart App Control, antivírus) faz o spawn falhar antes de qualquer linha.
// No kit, uma falha de spawn se simula com { deny }: o fluxo de quem chamou é rejeitado.
// O motivo entre parênteses, como o motor o escreve (o prefixo dele pode mudar entre versões).
const motivo = (texto: string | undefined): string => /\((.*)\)/.exec(texto ?? "")?.[1] ?? ''

function barrado(on: On, contador: { n: number }, erro = 'spawn UNKNOWN') {
  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () {
    contador.n++
    return { deny: erro }
  })
}

test('9. Windows com o exe barrado: diz que pode ser o Smart App Control e aponta o /config', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(), WINDOWS)
  const c = { n: 0 }; barrado(on, c)
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  const texto = (await a).text
  expect(texto).toBe(textos('pt').janelaBloqueada(motivo(texto)))
  expect(motivo(texto)).toMatch(/spawn UNKNOWN$/)
  expect(texto).toMatch(/Controle Inteligente de Aplicativos/)
  expect(texto).toMatch(/\/config/)
  // A trava soltou: um novo pedido tenta de novo.
  const b = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  await b
  expect(c.n).toBe(2)
})

test('9b. Windows, app que fecha antes do pronto: a mesma mensagem, com o motivo', { options: { ...OPC, idioma: 'en' } }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets, new Set(), WINDOWS)
  const f = app(on, { n: 0 })
  await comecar($)
  const a = $.command.run({ command: 'usage-settings' } as never)
  await relogio.settle(); f.fim()
  expect((await a).text).toBe(textos('en').janelaBloqueada('o app fechou antes de abrir a janela'))
})

test('9c. Mac, app barrado: a mensagem de sempre, sem falar de Windows', { options: OPC }, async ($, on) => {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  const loja = new Map<string, unknown>(); const sets: { key: string; value: unknown }[] = []
  base(on, loja, sets)
  barrado(on, { n: 0 }, 'spawn EACCES')
  await comecar($)
  const a = $.command.run({ command: 'uso-ajustes' } as never)
  await relogio.settle()
  const texto = (await a).text
  expect(texto).toBe(textos('pt').janelaFalhou(motivo(texto)))
  expect(motivo(texto)).toMatch(/spawn EACCES$/)
})
