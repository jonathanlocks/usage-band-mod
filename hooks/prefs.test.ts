import { expect, test } from 'claude-code/testing'

import { caminhoDoApp, lerLinha, situacao, temDotNet48 } from './janela'
import { PADRAO, iguais, preferencias } from './prefs'

test('preferências inválidas caem no padrão, campo a campo', () => {
  expect(preferencias({})).toEqual(PADRAO)
  expect(preferencias({ idioma: 'pt', moeda: 'JPY', mascote: 'parado', limitePorModelo: 'sim' }))
    .toEqual({ idioma: 'pt', moeda: 'USD', mascote: 'parado', limitePorModelo: true })
  expect(iguais(preferencias({ idioma: 'pt' }), { ...PADRAO, idioma: 'pt' })).toBe(true)
})

test('linhas da janela: preferências, fim, e o resto ignorado', () => {
  expect(lerLinha('{"prefs":{"moeda":"EUR"}}', PADRAO)).toEqual({ prefs: { ...PADRAO, moeda: 'EUR' } })
  // Moeda que o mod não oferece cai no padrão.
  expect(lerLinha('{"prefs":{"moeda":"BTC"}}', PADRAO)).toEqual({ prefs: PADRAO })
  expect(lerLinha('{"fim":true}', PADRAO)).toEqual({ fim: true })
  expect(lerLinha('{"pronto":true}', PADRAO)).toEqual({ pronto: true })
  expect(lerLinha('log solto', PADRAO)).toEqual({})
})

test('o app fica em macos/ dentro da pasta do plugin', () => {
  expect(caminhoDoApp('/x/usage-band-mod')).toBe('/x/usage-band-mod/macos/PainelDeUso.app/Contents/MacOS/PainelDeUso')
  expect(caminhoDoApp('/x/usage-band-mod/.claude-plugin')).toBe('/x/usage-band-mod/macos/PainelDeUso.app/Contents/MacOS/PainelDeUso')
})

test('o app fica em windows/ no Windows, com o separador da raiz', () => {
  expect(caminhoDoApp('C:\\Users\\ana\\.claude\\plugins\\cache\\usage-band-mod', 'windows')).toBe('C:\\Users\\ana\\.claude\\plugins\\cache\\usage-band-mod\\windows\\PainelDeUso.exe')
  expect(caminhoDoApp('C:\\x\\usage-band-mod\\.claude-plugin', 'windows')).toBe('C:\\x\\usage-band-mod\\windows\\PainelDeUso.exe')
  expect(caminhoDoApp('C:/x/usage-band-mod/', 'windows')).toBe('C:/x/usage-band-mod/windows/PainelDeUso.exe')
})

test('.NET 4.8 pela chave Release do registro', () => {
  expect(temDotNet48('\r\nHKEY_LOCAL_MACHINE\\...\\Full\r\n    Release    REG_DWORD    0x80ea8\r\n\r\n')).toBe(true) // 528040
  expect(temDotNet48('    Release    REG_DWORD    0x82348')).toBe(true) // 4.8.1
  expect(temDotNet48('    Release    REG_DWORD    0x70bf0')).toBe(false) // 4.7.2
  expect(temDotNet48('ERROR: The system was unable to find the specified registry key or value.')).toBe(false)
})

test('linha com \\r do Windows é lida', () => {
  expect(lerLinha('{"pronto":true}\r', PADRAO)).toEqual({ pronto: true })
  expect(lerLinha('{"prefs":{"moeda":"EUR"}}\r', PADRAO)).toEqual({ prefs: { ...PADRAO, moeda: 'EUR' } })
})

test('gravação retomada: conclui, continua ou cede ao /config', () => {
  const base = PADRAO
  const prefs = { ...PADRAO, idioma: 'pt' as const, moeda: 'BRL' as const }
  // O primeiro campo já entrou (o mod recarregou no meio): falta a moeda.
  const p = { prefs, base, recusado: false, aplicado: false }
  expect(situacao(p, { ...base, idioma: 'pt' })).toBe('continuar')
  expect(situacao(p, prefs)).toBe('pronto')
  // Alguém escolheu euro no /config enquanto isso: o menu vence.
  expect(situacao(p, { ...base, idioma: 'pt', moeda: 'EUR' })).toBe('descartar')
  // Já gravado sem recarga, e depois a pessoa voltou o idioma no /config: o menu vence.
  expect(situacao({ ...p, aplicado: true }, { ...prefs, idioma: 'en' })).toBe('descartar')
})
