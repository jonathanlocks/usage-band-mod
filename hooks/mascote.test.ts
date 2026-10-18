import { expect, test } from 'claude-code/testing'

import { MASCOTE_ALTURA, MASCOTE_ANIMADO, MASCOTE_LARGURA, MASCOTE_PARADO } from './mascote'

test('o mascote animado cabe no limite do Svg (131072 caracteres)', () => {
  expect(MASCOTE_ANIMADO.length < 131_072).toBe(true)
  expect(MASCOTE_ANIMADO.startsWith('<svg ')).toBe(true)
  expect(MASCOTE_ANIMADO.endsWith('</svg>')).toBe(true)
})

test('o desenho tem o tamanho que a banda reserva', () => {
  expect(MASCOTE_ANIMADO.includes(`width="${MASCOTE_LARGURA}" height="${MASCOTE_ALTURA}"`)).toBe(true)
  expect(MASCOTE_ANIMADO.includes('shape-rendering="crispEdges"')).toBe(true)
})

test('a rotação é SMIL em loop, sem script', () => {
  expect(MASCOTE_ANIMADO.includes('repeatCount="indefinite"')).toBe(true)
  expect(MASCOTE_ANIMADO.split('<animate ').length - 1 > 50).toBe(true)
  expect(/<script|\son[a-z]+=/i.test(MASCOTE_ANIMADO)).toBe(false)
})

test('com movimento reduzido, fica o Clawd parado', () => {
  expect(MASCOTE_ANIMADO.includes('@media (prefers-reduced-motion:reduce){.a{display:none}.e{display:inline}}')).toBe(true)
  expect(MASCOTE_ANIMADO.includes('<g class="e">')).toBe(true)
})

test('o mascote parado não tem animação', () => {
  expect(MASCOTE_PARADO.startsWith('<svg ')).toBe(true)
  expect(MASCOTE_PARADO.includes('<animate')).toBe(false)
})
