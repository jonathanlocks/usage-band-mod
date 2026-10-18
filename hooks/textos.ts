// Todos os textos que o mod mostra, em inglês e português.
import type { Idioma } from '../types'

const EN = {
  contexto: 'Context',
  bandaOculta: 'Usage band hidden.',
  bandaVisivel: 'Usage band visible.',
  janelaAberta: 'Settings window open.',
  janelaSoMac: 'The settings window needs macOS 26. Use /config instead: the options are under usage-band-mod.',
  janelaFalhou: (d: string) => `Could not open the settings window (${d}). Use /config instead.`,
  cmdBanda: 'Shows or hides the usage band above the prompt',
  cmdAjustes: 'Opens the settings window (macOS)',
  alt: 'Pixel crab mascot',
}

const PT: typeof EN = {
  contexto: 'Contexto',
  bandaOculta: 'Barra de uso escondida.',
  bandaVisivel: 'Barra de uso visível.',
  janelaAberta: 'Janela de ajustes aberta.',
  janelaSoMac: 'A janela de ajustes precisa do macOS 26. Use o /config: as opções estão em usage-band-mod.',
  janelaFalhou: (d: string) => `Não deu para abrir a janela de ajustes (${d}). Use o /config.`,
  cmdBanda: 'Mostra ou esconde a barra de uso acima do prompt',
  cmdAjustes: 'Abre a janela de ajustes (macOS)',
  alt: 'Mascote caranguejo em pixel',
}

export type Textos = typeof EN
export const textos = (idioma: Idioma): Textos => (idioma === 'pt' ? PT : EN)
