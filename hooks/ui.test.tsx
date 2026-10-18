import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// Uma sessão de assinatura com os números do exemplo do README.
function sessao(on: On, assinatura = true) {
  mock.clock(on, { now: 1_000_000_000 })
  mock.store(on)
  mock.env(on, {})
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { window: 200_000, tokens: 48_000, percent: 24 },
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
  on('session.turns', async () => ({ value: 3 }))
  on('process.run', async () => ({ value: { exitCode: 0, stdout: '26.6\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  // O que o Claude Code desenharia embaixo da banda: nada.
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="vazio" />
  })
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
