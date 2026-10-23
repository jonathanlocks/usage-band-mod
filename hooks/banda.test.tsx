import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf, SessionStartInput, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { encaixe } from './formato'
import { MASCOTE_TEXTO } from './ui'

const AGORA = 1_000_000_000
function sessao(on: On, assinatura: boolean, store: Record<string, unknown> = {}) {
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
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="vazio" />
  })
  return relogio
}
const comecar = ($: Engine) => $.session.start({ cwd: '/tmp', surface: null, isInteractive: true } as unknown as SessionStartInput)
const BANDA = (colunas: number) => ({ hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: colunas }) as unknown as RenderPropsOf['AbovePrompt']

const PINTADAS = ['success', 'warning', 'error', 'subtle']
// Texto de um nó desenhado: strings, rótulo de Button, recursivo.
function texto(n: unknown): string {
  if (typeof n === 'string') return n
  if (typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(texto).join('')
  if (n === null || typeof n !== 'object') return ''
  const o = n as { type?: string; props?: Record<string, unknown>; children?: unknown }
  if (o.type === 'Button') return String(o.props?.label ?? '')
  // Célula de barra (fundo pintado com a cor de um nível ou do trilho) aparece como █ no texto.
  if (o.type === 'Text' && PINTADAS.includes(String(o.props?.backgroundColor))) return texto(o.children ?? o.props?.children).replace(/ /g, '█')
  return texto(o.children ?? o.props?.children)
}
const filhos = (n: unknown): unknown[] => {
  const o = n as { children?: unknown; props?: { children?: unknown } }
  const c = o.children ?? o.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1).filter(x => x !== null && x !== undefined && x !== false)
}

const casos = [
  { nome: '1 trecho', assinatura: false, porModelo: false },
  { nome: '3 trechos', assinatura: true, porModelo: false },
  { nome: '4 trechos', assinatura: true, porModelo: true },
]
const MODELOS = { modelos: { em: AGORA, lidoEm: AGORA, estado: 'ok', detalhe: '', limites: [{ modelo: 'Fable', pct: 3, reinicia: null }] } }
const ROTULOS = /Contexto|Context|5h|7d|Fable/g

// Toda largura de 10 a 220, nos dois idiomas, medindo o que a linha ocupa DE VERDADE: o recuo
// (paddingLeft do Box da linha) mais o texto. Com barras, a linha fecha uma coluna antes da borda.
for (const idioma of ['pt', 'en'] as const) for (const caso of casos) {
  // 211 larguras por caso: no runner do Windows isso passa dos 5 s padrão.
  test(`largura desenhada (com o recuo) cabe em toda largura de 10 a 220, ${caso.nome}, ${idioma}`, { options: { idioma, limitePorModelo: caso.porModelo }, timeoutMs: 60_000 }, async ($, on) => {
    sessao(on, caso.assinatura, caso.porModelo ? MODELOS : {})
    await comecar($)
    for (let col = 10; col <= 220; col++) {
      const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(col) })
      const linha = filhos(await ui.drawn())[0] as { props?: { paddingLeft?: number } }
      const s = texto(linha)
      const ocupa = (linha.props?.paddingLeft ?? 0) + [...s].length
      const temBarra = /(Contexto|Context|5h|7d|Fable) █/.test(s)
      const trechos = (s.match(ROTULOS) ?? []).length
      if (ocupa > col) throw new Error(`col ${col}: a linha ocupa ${ocupa} > ${col}: "${s}"`)
      if (temBarra && ocupa !== col - 1) throw new Error(`col ${col}: com barras, ocupa ${ocupa} != ${col - 1}: "${s}"`)
      if (!temBarra) {
        // compacto: um espaço só entre rótulo e percentual
        for (const m of s.matchAll(/(Contexto|Context|5h|7d|Fable)( +)(\d+%|—)/g)) if (m[2] !== ' ') throw new Error(`col ${col}: espaço duplo "${m[0]}"`)
        if (!/  (Contexto|Context|5h|7d|Fable) (\d+%|—)/.test(s) && trechos > 0) throw new Error(`col ${col}: trecho não compacto "${s}"`)
      }
      await ui.unmount()
    }
  })
}

test('80 colunas, 3 trechos: cabeçalho inteiro', { options: { idioma: 'pt', limitePorModelo: false } }, async ($, on) => {
  sessao(on, true)
  await comecar($)
  const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(80) })
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /US\$ 3,26/ })).toBeDefined()
  // O mascote abre a linha: braço, corpo laranja com olhos pretos, braço, e um espaço.
  const mascote = filhos(filhos(await ui.drawn())[0])[0] as { type: string; children: unknown[] }
  expect(mascote.type).toBe('Text')
  expect(texto(mascote)).toBe(`${MASCOTE_TEXTO} `)
  const olhos = filhos(mascote).filter(p => texto(p) === '▮') as { props: Record<string, unknown> }[]
  expect(olhos.map(o => o.props)).toEqual([{ color: '#000000', backgroundColor: 'claude' }, { color: '#000000', backgroundColor: 'claude' }])
})

test('o mascote oculto some do terminal e a linha ainda fecha na largura', { options: { idioma: 'pt', limitePorModelo: false, mascote: 'oculto' } }, async ($, on) => {
  sessao(on, true)
  await comecar($)
  for (const col of [60, 100, 160]) {
    const ui = await $.ui.mount({ plugin: 'usage-band-mod', surface: 'terminal', component: 'AbovePrompt', props: BANDA(col) })
    const s = texto(filhos(await ui.drawn())[0])
    expect(s.includes('▮')).toBe(false)
    if (/Contexto █/.test(s)) expect([...s].length).toBe(col - 2)
    await ui.unmount()
  }
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
      expect(t).toMatch(espera)
  })
}
