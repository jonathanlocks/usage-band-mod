// Preferências do mod. A fonte é o `userConfig` do plugin.json (o menu de configurações do
// Claude Code e a tela de instalação). A janela do Mac grava por cima, ao vivo, e no fim passa
// tudo para o `userConfig` por `$.config.set`.
import type { PluginOptions } from 'claude-code'

import type { Idioma, Mascote, Moeda, Preferencias } from '../types'

export const IDIOMAS: readonly Idioma[] = ['en', 'pt']
export const MOEDAS: readonly Moeda[] = ['USD', 'BRL', 'EUR']
export const MASCOTES: readonly Mascote[] = ['animado', 'parado', 'oculto']

export const PADRAO: Preferencias = { idioma: 'en', moeda: 'USD', mascote: 'animado', limitePorModelo: true }

const entre = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T =>
  typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : padrao

// Lê qualquer objeto (options do engine, $.store, linha da janela) e devolve preferências válidas.
export function preferencias(v: unknown, base: Preferencias = PADRAO): Preferencias {
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  return {
    idioma: entre(IDIOMAS, o.idioma, base.idioma),
    moeda: entre(MOEDAS, o.moeda, base.moeda),
    mascote: entre(MASCOTES, o.mascote, base.mascote),
    limitePorModelo: typeof o.limitePorModelo === 'boolean' ? o.limitePorModelo : base.limitePorModelo,
  }
}

export const deOpcoes = (options: PluginOptions | undefined): Preferencias => preferencias(options ?? {})

export const iguais = (a: Preferencias, b: Preferencias): boolean =>
  a.idioma === b.idioma && a.moeda === b.moeda && a.mascote === b.mascote && a.limitePorModelo === b.limitePorModelo
