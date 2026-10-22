// Janela de ajustes: no Mac um app SwiftUI (macos/), no Windows um app WPF (windows/), que o mod
// abre e escuta. Os dois falam o mesmo protocolo.
// Conversa por linhas JSON: o app escreve {"pronto": true} ao aparecer, {"prefs": {...}} a cada
// mudança e {"fim": true} ao fechar. As mudanças valem na hora (átomo `ajuste`); ao fechar, vão
// para o userConfig por $.config.set, para que o menu /config e as próximas sessões vejam o mesmo.
// Aqui só a parte pura; abrir, escutar e gravar ficam em ./register, porque motores mais antigos do
// Claude Code (o 2.1.295 do app desktop) não aceitam $ passado entre arquivos.
import type { Cambio, Leitura, LeituraModelos, Preferencias } from '../types'
import { iguais, preferencias } from './prefs'

export const CHAVE_AJUSTE = 'ajuste'
export const CAMPOS = ['idioma', 'moeda', 'mascote', 'limitePorModelo'] as const

// Onde a janela mora em cada sistema.
export type Plataforma = 'macos' | 'windows'

// No Windows a raiz pode vir com `\` ou `/`: o caminho do exe usa o mesmo separador que ela.
export function caminhoDoApp(raiz: string, p: Plataforma = 'macos'): string {
  const pasta = raiz.replace(/[\\/]\.claude-plugin[\\/]?$/, '').replace(/[\\/]$/, '')
  if (p === 'windows') {
    const sep = pasta.includes('\\') ? '\\' : '/'
    return [pasta, 'windows', 'PainelDeUso.exe'].join(sep)
  }
  return `${pasta}/macos/PainelDeUso.app/Contents/MacOS/PainelDeUso`
}

// Saída de `reg.exe query ...\NDP\v4\Full /v Release`: tem .NET Framework 4.8 (528040) ou mais novo?
export function temDotNet48(saidaDoReg: string): boolean {
  const m = /\bRelease\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(saidaDoReg)
  return m !== null && parseInt(m[1] ?? '', 16) >= 528040
}

// Uma linha do app: só aceita preferências válidas; o resto é ignorado.
export function lerLinha(linha: string, base: Preferencias): { prefs?: Preferencias; fim?: true; pronto?: true } {
  try {
    // trim: no Windows a linha pode chegar com um \r sobrando.
    const o = JSON.parse(linha.trim()) as Record<string, unknown>
    if (o.pronto === true) return { pronto: true }
    if (o.fim === true) return { fim: true }
    if (typeof o.prefs === 'object' && o.prefs !== null) return { prefs: preferencias(o.prefs, base) }
  } catch {
    // Linha que não é JSON (log do app): ignora.
  }
  return {}
}

// Gravação no userConfig. Cada $.config.set pode recarregar o mod no meio do caminho, então o
// pedido inteiro fica antes no $.store ({ prefs, base }) e cada carga aplica o que falta.
// `aplicado`: tudo já foi gravado sem recarga; daí em diante, uma mudança no /config vence.
export type Pendente = { prefs: Preferencias; base: Preferencias; recusado: boolean; aplicado: boolean }

export function pendenteValido(v: unknown): Pendente | null {
  if (typeof v !== 'object' || v === null) return null
  const g = v as { prefs?: unknown; base?: unknown; recusado?: unknown; aplicado?: unknown }
  if (typeof g.prefs !== 'object' || typeof g.base !== 'object') return null
  return { prefs: preferencias(g.prefs), base: preferencias(g.base), recusado: g.recusado === true, aplicado: g.aplicado === true }
}

// O que fazer com um pedido pendente diante do userConfig atual:
// - 'pronto': tudo já está gravado;
// - 'descartar': alguém mexeu no /config por fora, e o menu vence;
// - 'continuar': ainda há campos a gravar (ou o /config recusou, e o ajuste fica valendo).
export function situacao(p: Pendente, opcoes: Preferencias): 'pronto' | 'descartar' | 'continuar' {
  if (iguais(p.prefs, opcoes)) return 'pronto'
  for (const campo of CAMPOS) {
    if (opcoes[campo] !== p.base[campo] && opcoes[campo] !== p.prefs[campo]) return 'descartar'
  }
  // Já gravado e o /config voltou um campo ao valor antigo: foi a pessoa, e o menu vence.
  return p.aplicado ? 'descartar' : 'continuar'
}

// Quanto esperar o app dizer {"pronto":true} antes de desistir.
export const PRAZO_PRONTO = 15_000

export type Abertura = 'aberta' | 'ja-aberta' | 'falhou'

// O que a janela mostra na prévia: os números da sessão, ou exemplos enquanto não há leitura.
export function amostra(l: Leitura | null, m: LeituraModelos | null, c: Cambio | null) {
  return {
    modelo: l?.modelo ?? 'Opus 5.5',
    usd: l?.usd ?? 3.26,
    contexto: l?.pct ?? 24,
    cincoHoras: l?.limites.find(x => x.tipo === 'five_hour')?.pct ?? 5,
    semana: l?.limites.find(x => x.tipo === 'seven_day')?.pct ?? 1,
    porModelo: (m?.limites ?? []).map(x => ({ modelo: x.modelo, pct: x.pct ?? 0 })),
    taxas: c?.taxas ?? {},
  }
}
