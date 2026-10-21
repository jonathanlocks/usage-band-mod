import { expect, test } from 'claude-code/testing'

import { PCT_COLUNAS, RECUO, SEP_BARRAS, SEP_COMPACTO, barra, dinheiro, encaixe, nomeBonito, numero, pctTexto } from './formato'
import type { Cabeca, Trecho } from './formato'

// Cabeçalho de exemplo: o mascote e um espaço (6), "Opus 5.5" (8), " · US$ 3,26" (11).
const CABECA: Cabeca = { glifo: 6, modelo: 8, custo: 11 }
const TRECHOS: Trecho[] = [
  { rotulo: 'Contexto', pct: 42, extra: '84k/200k' },
  { rotulo: '5h', pct: 30, extra: '↻ 2h 10m' },
  { rotulo: '7d', pct: null, extra: '↻ 3d 4h' },
  { rotulo: 'Fable', pct: 61, extra: '↻ 3d 4h' },
]

// Largura real da linha que a banda desenha no terminal, pela mesma conta do desenho em ui.tsx.
function largura(colunas: number, trechos: Trecho[]): number {
  const { w, resto, comExtra, cabeca, mostrar } = encaixe(colunas, CABECA, trechos)
  const cab = cabeca === 'toda' ? CABECA.glifo + CABECA.modelo + CABECA.custo : cabeca === 'sem-custo' ? CABECA.glifo + CABECA.modelo : cabeca === 'so-modelo' ? CABECA.modelo : 0
  const usados = trechos.slice(0, mostrar)
  const corpo = w === 0
    ? usados.reduce((s, t) => s + SEP_COMPACTO + t.rotulo.length + 1 + pctTexto(t.pct).length, 0)
    : resto + usados.reduce((s, t) => s + SEP_BARRAS + t.rotulo.length + 1 + w + 1 + PCT_COLUNAS + (comExtra ? 1 + t.extra.length : 0), 0)
  return RECUO + cab + corpo + 2
}

test('terminal largo: barras esticadas e detalhe', () => {
  expect(encaixe(150, CABECA, TRECHOS)).toMatchObject({ comExtra: true, cabeca: 'toda', mostrar: 4 })
  expect(encaixe(150, CABECA, TRECHOS).w >= 5).toBe(true)
})

test('aperto médio: o detalhe sai antes das barras', () => {
  const e = encaixe(100, CABECA, TRECHOS)
  expect(e).toMatchObject({ comExtra: false, cabeca: 'toda', mostrar: 4 })
  expect(e.w >= 3).toBe(true)
})

test('sem barras, o cabeçalho perde custo, depois o mascote, depois o modelo, e só então os trechos', () => {
  const ordem = ['toda', 'sem-custo', 'so-modelo', 'nada']
  let anterior = 0
  for (let colunas = 90; colunas >= 18; colunas--) {
    const e = encaixe(colunas, CABECA, TRECHOS)
    if (e.w > 0) continue
    const nivel = ordem.indexOf(e.cabeca)
    expect(nivel >= anterior).toBe(true)
    anterior = nivel
    if (e.cabeca !== 'nada') expect(e.mostrar).toBe(4)
  }
  expect(encaixe(80, CABECA, TRECHOS).cabeca).toBe('toda')
})

test('a linha nunca passa da largura disponível, de 18 a 200 colunas, com ou sem limite por modelo', () => {
  for (let colunas = 18; colunas <= 200; colunas++) {
    expect(largura(colunas, TRECHOS) <= colunas).toBe(true)
    expect(largura(colunas, TRECHOS.slice(0, 3)) <= colunas).toBe(true)
    expect(largura(colunas, TRECHOS.slice(0, 1)) <= colunas).toBe(true)
  }
})

test('com barras, a linha (recuo incluído) ocupa a largura toda menos a margem direita', () => {
  for (let colunas = 100; colunas <= 200; colunas++) {
    expect(largura(colunas, TRECHOS)).toBe(colunas - 1)
  }
})

test('nomeBonito entende os formatos da Anthropic, do Bedrock e do Vertex', () => {
  expect(nomeBonito('claude-opus-5-5')).toBe('Opus 5.5')
  expect(nomeBonito('claude-fable-5-1')).toBe('Fable 5.1')
  expect(nomeBonito('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(nomeBonito('us.anthropic.claude-opus-4-1-20250805-v1:0')).toBe('Opus 4.1')
  expect(nomeBonito('claude-opus-4-1@20250805')).toBe('Opus 4.1')
  expect(nomeBonito('claude-sonnet-4-20250514')).toBe('Sonnet 4')
  expect(nomeBonito('meu-modelo')).toBe('Meu')
})

test('números seguem o idioma', () => {
  expect(numero(1247.3, 2, 'pt')).toBe('1.247,30')
  expect(numero(1247.3, 2, 'en')).toBe('1,247.30')
})

test('dinheiro: dólar sem rede, outras moedas pela taxa', () => {
  expect(dinheiro(3.26, 'USD', null, 'en')).toBe('$3.26')
  expect(dinheiro(3.26, 'USD', null, 'pt')).toBe('US$ 3,26')
  expect(dinheiro(3.26, 'BRL', 5.4, 'pt')).toBe('R$ 17,60')
  expect(dinheiro(3.26, 'EUR', 0.92, 'en')).toBe('€3.00')
  // Sem taxa para a moeda escolhida, fica em dólar em vez de inventar.
  expect(dinheiro(3.26, 'BRL', null, 'pt')).toBe('US$ 3,26')
})

test('barra: células inteiras, com os extremos honestos', () => {
  expect(barra(56, 9)).toEqual({ cheio: ' '.repeat(5), vazio: ' '.repeat(4) })
  expect(barra(130, 4)).toEqual({ cheio: '    ', vazio: '' })
  expect(barra(0, 9)).toEqual({ cheio: '', vazio: ' '.repeat(9) })
  // Acima de 0 e abaixo de meia célula: uma célula cheia, não um trilho vazio.
  expect(barra(2, 9)).toEqual({ cheio: ' ', vazio: ' '.repeat(8) })
  expect(barra(4, 9)).toEqual({ cheio: ' ', vazio: ' '.repeat(8) })
  // Abaixo de 100 e perto dele: uma célula vazia, não uma barra cheia.
  expect(barra(97, 9)).toEqual({ cheio: ' '.repeat(8), vazio: ' ' })
  expect(barra(100, 9)).toEqual({ cheio: ' '.repeat(9), vazio: '' })
  // Sem leitura não há barra nenhuma (quem desenha põe a linha pontilhada).
  expect(barra(null, 9)).toEqual({ cheio: '', vazio: '' })
})
