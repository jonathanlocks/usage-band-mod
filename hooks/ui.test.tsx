import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { textos } from './textos'

// Uma sessão de assinatura com os números do exemplo do README.
function sessao(
  on: On,
  assinatura = true,
  windows = false,
  contexto: unknown = { window: 200_000, tokens: 48_000, percent: 24 },
  sistemaResponde: Promise<void> = Promise.resolve(),
) {
  const relogio = mock.clock(on, { now: 1_000_000_000 })
  mock.store(on)
  mock.env(on, windows ? { OS: 'Windows_NT' } : {})
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: contexto,
      rateLimits: assinatura
        ? [
            { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-18T20:00:00Z' },
            { kind: 'seven_day', percentUsed: 1, resetsAt: '2026-10-22T20:00:00Z' },
          ]
        : [],
      cost: { usd: 3.26 },
    } as unknown as SessionUsage,
  }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  // No Mac, o sw_vers; no Windows, a chave Release do .NET 4.8 no registro.
  const stdout = windows ? '    Release    REG_DWORD    0x80ea8\r\n' : '26.6\n'
  on('process.run', async () => {
    await sistemaResponde
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // O que o Claude Code desenharia embaixo da banda: nada.
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="vazio" />
  })
  return relogio
}

async function comecar($: Engine) {
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
}

const BANDA = (colunas: number) =>
  ({ hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: colunas }) as unknown as RenderPropsOf['AbovePrompt']

test('a banda mostra modelo, custo e barras no terminal e no desktop', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on)
  await comecar($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface, component: 'AbovePrompt', props: BANDA(140) })
    expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /US\$ 3,26/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Contexto/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5h/ })).toBeDefined()
    // O mascote animado só existe onde há Svg; no terminal, a cabeça em blocos.
    expect((await ui.find({ type: 'Svg' })) !== undefined).toBe(surface === 'desktop')
    // O ⚙ da janela de ajustes só no desktop (e só no macOS 26, que o process.run acima simula).
    expect((await ui.find({ key: 'ajustes' })) !== undefined).toBe(surface === 'desktop')
    await ui.unmount()
  }
})

test('o ⚙ aparece assim que o sistema responde, sem esperar o tique do minuto', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  let responder = (): void => {}
  const relogio = sessao(on, true, false, undefined, new Promise<void>(r => (responder = r)))
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'desktop', component: 'AbovePrompt', props: BANDA(140) })
  expect((await ui.find({ key: 'ajustes' })) !== undefined).toBe(false)
  responder()
  await relogio.settle()
  expect((await ui.find({ key: 'ajustes' })) !== undefined).toBe(true)
  await ui.unmount()
})

test('8. ⚙ no desktop do Windows (com .NET 4.8), não no terminal', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on, true, true)
  await comecar($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface, component: 'AbovePrompt', props: BANDA(140) })
    expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
    expect((await ui.find({ key: 'ajustes' })) !== undefined).toBe(surface === 'desktop')
    await ui.unmount()
  }
})

test('8b. ⚙ no Windows com o exe barrado: o motivo aparece num aviso', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  const relogio = sessao(on, true, true)
  const avisos: string[] = []
  on('ui.toast', async (_$, e) => { avisos.push(e.text); return { value: undefined } })
  // eslint-disable-next-line require-yield
  on('process.spawn', async function* () { return { deny: 'spawn UNKNOWN' } })
  await comecar($)
  // O ⚙ só existe depois que o sistema respondeu se há janela.
  await relogio.settle()
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'desktop', component: 'AbovePrompt', props: BANDA(140) })
  await ui.press({ key: 'ajustes' })
  await relogio.settle()
  expect(avisos.length).toBe(1)
  const motivo = /\((.*)\)/.exec(avisos[0] ?? '')?.[1] ?? ''
  expect(motivo).toMatch(/spawn UNKNOWN$/)
  expect(avisos[0]).toBe(textos('pt').janelaBloqueada(motivo))
})

test('sem assinatura, as barras de 5h e 7d não aparecem', { options: { limitePorModelo: false } }, async ($, on) => {
  sessao(on, false)
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(140) })
  expect(await ui.find({ type: 'Text', text: /Context/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5h/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /7d/ })).toBeUndefined()
})

test('o × esconde a banda', { options: { limitePorModelo: false } }, async ($, on) => {
  sessao(on)
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'desktop', component: 'AbovePrompt', props: BANDA(140) })
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
  await ui.press({ key: 'ocultar' })
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeUndefined()
})

const PINTADAS = ['success', 'warning', 'error', 'subtle']
// Texto de um nó desenhado: strings, rótulo de Button, recursivo.
function texto(n: unknown): string {
  if (typeof n === 'string') return n
  if (Array.isArray(n)) return n.map(texto).join('')
  if (n === null || typeof n !== 'object') return ''
  const o = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
  if (o.type === 'Button') return String(o.props?.label ?? '')
  // Célula de barra (fundo pintado com a cor de um nível ou do trilho) aparece como █ no texto.
  if (o.type === 'Text' && PINTADAS.includes(String(o.props?.backgroundColor))) return texto(o.children ?? o.props?.children).replace(/ /g, '█')
  return texto(o.children ?? o.props?.children)
}
type No = { type?: string; props?: Record<string, unknown>; children?: unknown }
const filhos = (n: unknown): No[] => {
  const o = n as No
  const c = o.children ?? o.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1).filter(x => x !== null && x !== undefined && x !== false) as No[]
}
const todos = (n: unknown): No[] => (typeof n === 'object' && n !== null ? [n as No, ...filhos(n).flatMap(todos)] : [])

test('o ↻ só marca reinício: o contexto mostra tokens sem ele, no terminal e no desktop', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on)
  await comecar($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface, component: 'AbovePrompt', props: BANDA(180) })
    const s = texto(filhos(await ui.drawn())[0])
    expect(s).toMatch(/24% *48k\/200k/)
    expect(s.includes('↻ 48k')).toBe(false)
    expect(s).toMatch(/5% *↻ \d/)
    expect(s).toMatch(/1% *↻ \d/)
    await ui.unmount()
  }
})

test('no terminal: alinhada à esquerda, barras de fundo pintado com trilho na cor discreta do tema, × discreto', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on)
  await comecar($)
  for (const col of [60, 140]) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(col) })
    const linha = filhos(await ui.drawn())[0] as No
    expect(linha.props?.paddingLeft).toBe(1)
    expect(linha.props?.justifyContent).toBeUndefined()
    const fechar = todos(linha).find(n => n.type === 'Button')
    expect(fechar?.props?.label).toBe('×')
    expect(fechar?.props?.dimColor).toBe(true)
    const trilhos = todos(linha).filter(n => n.type === 'Text' && n.props?.backgroundColor === 'subtle')
    if (col === 140) {
      expect(trilhos.length).toBe(3)
      expect(trilhos.every(t => /^█+$/.test(texto(t)))).toBe(true)
      expect(todos(linha).some(n => n.type === 'Text' && n.props?.backgroundColor === 'success')).toBe(true)
    }
    expect(texto(linha).includes('░')).toBe(false)
    await ui.unmount()
  }
})

test('sem leitura de contexto: linha pontilhada apagada no lugar da barra, — apagado, e a linha fecha na largura', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on, true, false, { window: 200_000 })
  await comecar($)
  for (let col = 100; col <= 200; col += 7) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(col) })
    const linha = filhos(await ui.drawn())[0] as No
    const s = texto(linha)
    expect(s).toMatch(/Contexto ·+ —      5h █/)
    // Nenhuma célula de trilho no trecho do contexto: só o 5h e o 7d pintam.
    expect(todos(linha).filter(n => n.type === 'Text' && n.props?.backgroundColor === 'subtle').length).toBe(2)
    const traco = todos(linha).find(n => n.type === 'Text' && texto(n) === ' —')
    expect(traco?.props?.dimColor).toBe(true)
    expect(1 + [...s].length).toBe(col - 1)
    await ui.unmount()
  }
})

test('o percentual encosta na barra dele e o resto das 4 colunas vai para o fim do trecho', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on)
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(180) })
  const s = texto(filhos(await ui.drawn())[0])
  expect(s).toMatch(/Contexto █+ 24% 48k\/200k    5h █+ 5% ↻ [^ ]+ [^ ]+     7d █+ 1% ↻ [^ ]+ [^ ]+   ×$/)
  // 5% e 1% acima de zero: ao menos uma célula cheia na barra.
  const linha = filhos(await ui.drawn())[0] as No
  expect(todos(linha).filter(n => n.type === 'Text' && n.props?.backgroundColor === 'success').length).toBe(3)
})
