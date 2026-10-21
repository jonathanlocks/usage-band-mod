// Todos os textos que o mod mostra, em inglês e português.
import type { Idioma } from '../types'

const EN = {
  contexto: 'Context',
  bandaOculta: 'Usage band hidden.',
  bandaVisivel: 'Usage band visible.',
  janelaAberta: 'Settings window open.',
  janelaIndisponivel: 'The settings window needs macOS 26 or Windows 10/11 (1903 or later, with .NET Framework 4.8). Use /config instead: the options are under usage-band-mod.',
  janelaFalhou: (d: string) => `Could not open the settings window (${d}). Use /config instead.`,
  // No Windows o exe não tem assinatura digital: o Smart App Control ou um antivírus podem barrá-lo.
  janelaBloqueada: (d: string) =>
    `Could not open the settings window (${d}). On Windows, Smart App Control or an antivirus may have blocked PainelDeUso.exe, which is not code-signed. Use /config instead: the options are under usage-band-mod.`,
  cmdBanda: 'Shows or hides the usage band above the prompt',
  cmdAjustes: 'Opens the settings window (macOS, Windows)',
  alt: 'Pixel crab mascot',
}

const PT: typeof EN = {
  contexto: 'Contexto',
  bandaOculta: 'Barra de uso escondida.',
  bandaVisivel: 'Barra de uso visível.',
  janelaAberta: 'Janela de ajustes aberta.',
  janelaIndisponivel: 'A janela de ajustes precisa do macOS 26 ou do Windows 10/11 (1903 ou mais novo, com .NET Framework 4.8). Use o /config: as opções estão em usage-band-mod.',
  janelaFalhou: (d: string) => `Não deu para abrir a janela de ajustes (${d}). Use o /config.`,
  janelaBloqueada: (d: string) =>
    `Não deu para abrir a janela de ajustes (${d}). No Windows, o Controle Inteligente de Aplicativos ou um antivírus pode ter bloqueado o PainelDeUso.exe, que não tem assinatura digital. Use o /config: as opções estão em usage-band-mod.`,
  cmdBanda: 'Mostra ou esconde a barra de uso acima do prompt',
  cmdAjustes: 'Abre a janela de ajustes (macOS, Windows)',
  alt: 'Mascote caranguejo em pixel',
}

export type Textos = typeof EN
export const textos = (idioma: Idioma): Textos => (idioma === 'pt' ? PT : EN)
