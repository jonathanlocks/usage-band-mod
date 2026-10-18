import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { encaixe } from './formato'

const AGORA = 1_000_000_000
function sessao(on: On, assinatura: boolean, store: Record<string, unknown> = {}) {
  return sessao2(on, assinatura, store)
}
function sessao2(on: On, assinatura: boolean, store: Record<string, unknown>) {
  const relogio = mock.clock(on, { now: AGORA })
  mock.store(on, store)
  mock.env(on, { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.authorize', async () => ({ value: null }))
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
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="vazio" />
  })
  return relogio
}
const comecar = ($: Engine) => $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
const BANDA = (colunas: number) => ({ hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: colunas }) as unknown as RenderPropsOf['AbovePrompt']

// Texto de um nó desenhado: strings, rótulo de Button, recursivo.
function texto(n: unknown): string {
  if (typeof n === 'string') return n
  if (typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(texto).join('')
  if (n === null || typeof n !== 'object') return ''
  const o = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
  if (o.type === 'Button') return String(o.props?.label ?? '')
  return texto(o.children ?? o.props?.children)
}
const filhos = (n: unknown): unknown[] => {
  const o = n as { children?: unknown; props?: { children?: unknown } }
  const c = o.children ?? o.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1).filter(x => x !== null && x !== undefined && x !== false)
}

const casos = [
  { nome: '1 trecho', assinatura: false, porModelo: false, n: 1 },
  { nome: '3 trechos', assinatura: true, porModelo: false, n: 3 },
  { nome: '4 trechos', assinatura: true, porModelo: true, n: 4 },
]
const MODELOS = { modelos: { em: AGORA, lidoEm: AGORA, estado: 'ok', detalhe: '', limites: [{ modelo: 'Fable', pct: 3, reinicia: null }] } }
const relatorio: string[] = []

for (const caso of casos) {
  test(`largura desenhada bate com encaixe, ${caso.nome}`, { options: { idioma: 'pt', limitePorModelo: caso.porModelo } }, async ($, on) => {
    sessao(on, caso.assinatura, caso.porModelo ? MODELOS : {})
    await comecar($)
    const ordem: string[] = []
    for (let col = 18; col <= 200; col++) {
      const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(col) })
      const raiz = await ui.drawn()
      const linha = filhos(raiz)[0]
      const s = texto(linha)
      const largura = [...s].length
      const temBarra = /(Contexto|5h|7d|Fable) [█░]/.test(s)
      const nivel = (s.includes('US$') ? 'C' : '') + (s.includes('▐▛') ? 'G' : '') + (s.includes('Opus 5.5') ? 'M' : '')
      const trechos = (s.match(/Contexto|5h|7d|Fable/g) ?? []).length
      if (ordem[ordem.length - 1] !== `${nivel}/${trechos}/${temBarra ? 'b' : 'c'}`) ordem.unshift(`${col}:${nivel}/${trechos}/${temBarra ? 'b' : 'c'}`)
      if (largura > col) throw new Error(`col ${col}: largura ${largura} > colunas: "${s}"`)
      if (temBarra && largura !== col - 2) throw new Error(`col ${col}: com barras, largura ${largura} != ${col - 2}: "${s}"`)
      if (!temBarra) {
        // compacto: um espaço só entre rótulo e percentual
        for (const m of s.matchAll(/(Contexto|5h|7d|Fable)( +)(\d+%|—)/g)) if (m[2] !== ' ') throw new Error(`col ${col}: espaço duplo "${m[0]}"`)
        if (!/  (Contexto|5h|7d|Fable) (\d+%|—)/.test(s) && trechos > 0) throw new Error(`col ${col}: trecho não compacto "${s}"`)
      }
      if (col === 80) relatorio.push(`${caso.nome} @80: "${s}"`)
      if (col === 18 || col === 30 || col === 45) relatorio.push(`${caso.nome} @${col}: "${s}"`)
      await ui.unmount()
    }
    relatorio.push(`${caso.nome} transições (col:CGM/trechos/modo, desc): ${ordem.join(' ')}`)
    void 0
  })
}

test('80 colunas, 3 trechos: cabeçalho inteiro', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on, true)
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(80) })
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /US\$ 3,26/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▐▛███▜▌ ' })).toBeDefined()
})

test('ordem de queda do cabeçalho em encaixe', () => {
  const cab = { glifo: 8, modelo: 8, custo: 11 }
  const tr = [{ rotulo: 'Contexto', pct: 56, extra: '' }, { rotulo: '5h', pct: 5, extra: '' }, { rotulo: '7d', pct: 1, extra: '' }]
  const seq: string[] = []
  for (let c = 200; c >= 10; c--) {
    const e = encaixe(c, cab, tr)
    const k = `${e.w > 0 ? 'b' : 'c'}:${e.cabeca}:${e.mostrar}`
    if (seq[seq.length - 1] !== k) seq.push(k)
  }
  void 0
  const niveis = seq.filter(x => x.startsWith('c:')).map(x => x.split(':')[1])
  expect([...new Set(niveis)]).toEqual(['toda', 'sem-custo', 'so-modelo', 'nada'])
  expect(seq.filter(x => !x.endsWith(':3')).every(x => x.includes(':nada:'))).toBe(true)
})

for (const [nome, idade, espera] of [['velho (4d)', 4 * 86_400_000, /US\$ 3,26/], ['novo (1h)', 3_600_000, /R\$ 16,30/]] as const) {
  test(`câmbio ${nome}`, { options: { idioma: 'pt', moeda: 'BRL', limitePorModelo: false } }, async ($, on) => {
    const relogio = sessao(on, true, { cambio: { em: AGORA, lidoEm: AGORA - idade, falhas: 0, taxas: { BRL: 5 } } })
    await comecar($)
    await relogio.advance(1_000)
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(140) })
    const t = texto(filhos(await ui.drawn())[0])
    void 0
    expect(t).toMatch(espera)
  })
}
