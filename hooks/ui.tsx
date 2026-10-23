// O desenho da banda de uma linha acima do prompt, no terminal e no app desktop.
import type { EngineInterface, RenderElement } from 'claude-code'

import type { Leitura, LeituraModelos, Limite, Preferencias } from '../types'
import { PCT_COLUNAS, SEP_BARRAS, SEP_COMPACTO, barra, corDe, curto, dinheiro, encaixe, faltam, pctTexto } from './formato'
import type { Trecho } from './formato'
import { MASCOTE_ALTURA, MASCOTE_ANIMADO, MASCOTE_LARGURA, MASCOTE_PARADO } from './mascote'
import { textos } from './textos'
import { VALIDADE_MODELOS } from './fontes'

// Trilho das barras no desktop: cinza translúcido, escuro no tema escuro e claro no claro,
// para o preenchimento verde se destacar (o tom "subtle" ficava quase do brilho do verde).
const TRILHO = '#80808059'
const OLHO = '#000000'

// No terminal, o Clawd numa linha: braço, corpo laranja com dois olhos pretos e altos, braço.
// O corpo é fundo pintado (sem as emendas que o Terminal.app deixa entre blocos vizinhos) e os
// olhos são pretos nos dois temas, como no Clawd do próprio Claude Code. Os braços são traços na
// meia altura (╺ ╸), para fora do corpo; nos quadrantes de baixo (▗ ▖) o conjunto lia como focinho.
// A primeira linha do logo dele (▐▛███▜▌), que a banda usava antes, lia como um bloco cortado.
const MASCOTE_PARTES = [
  { t: '╺', cor: 'claude' },
  { t: '▮', cor: OLHO, fundo: 'claude' },
  { t: ' ', fundo: 'claude' },
  { t: '▮', cor: OLHO, fundo: 'claude' },
  { t: '╸', cor: 'claude' },
] as const

// Sem leitura, no lugar da barra vai uma linha pontilhada apagada: "sem dado" não pode parecer
// "0% usado" (um trilho cinza cheio). O · existe em toda fonte, inclusive no console antigo do Windows.
const SEM_LEITURA = '·'
export const MASCOTE_TEXTO = MASCOTE_PARTES.map(p => p.t).join('')

const limite = (l: Limite[], tipo: string): Limite | null => l.find(x => x.tipo === tipo) ?? null

export type Contexto = {
  l: Leitura
  prefs: Preferencias
  modelos: LeituraModelos | null
  taxa: number | null
  agora: number
}

// "↻ 2h 10m": o ↻ diz "reinicia em" e só aparece num reinício (o contexto mostra tokens, sem ele).
const reinicio = (iso: string | null, agora: number): string => {
  const f = faltam(iso, agora)
  return f === '' ? '' : `↻ ${f}`
}

// Os trechos da banda. 5h e 7d só entram quando a sessão tem esses limites (assinatura).
function trechosDaBanda(c: Contexto): Trecho[] {
  const t = textos(c.prefs.idioma)
  const cinco = limite(c.l.limites, 'five_hour')
  const sete = limite(c.l.limites, 'seven_day')
  const m = c.modelos
  const porModelo = c.prefs.limitePorModelo && m !== null && m.lidoEm !== null && c.agora - m.lidoEm < VALIDADE_MODELOS ? m.limites : []
  return [
    { rotulo: t.contexto, pct: c.l.pct, extra: c.l.tokens === null ? '' : `${curto(c.l.tokens)}/${curto(c.l.janela)}` },
    ...(cinco === null ? [] : [{ rotulo: '5h', pct: cinco.pct, extra: reinicio(cinco.reinicia, c.agora) }]),
    ...(sete === null ? [] : [{ rotulo: '7d', pct: sete.pct, extra: reinicio(sete.reinicia, c.agora) }]),
    ...porModelo.map(x => ({ rotulo: x.modelo, pct: x.pct, extra: reinicio(x.reinicia, c.agora) })),
  ]
}

const custoCurto = (c: Contexto): string =>
  c.l.usd === null ? '' : ` · ${dinheiro(c.l.usd, c.prefs.moeda, c.taxa, c.prefs.idioma)}`

type Ui = ReturnType<EngineInterface['ui']['resolve']>

function mascoteTexto(ui: Ui): RenderElement {
  const { Text } = ui
  return (
    <Text>
      {MASCOTE_PARTES.map(p => (
        <Text color={'cor' in p ? p.cor : undefined} backgroundColor={'fundo' in p ? p.fundo : undefined}>{p.t}</Text>
      ))}
      {' '}
    </Text>
  )
}

function mascoteGrafico(ui: Ui, prefs: Preferencias): RenderElement | null {
  if (prefs.mascote === 'oculto' || !('Svg' in ui)) return null
  const { Box } = ui
  const Svg = ui.Svg
  return (
    <Box key="mascote" marginRight={1}>
      <Svg
        source={prefs.mascote === 'animado' ? MASCOTE_ANIMADO : MASCOTE_PARADO}
        alt={textos(prefs.idioma).alt}
        width={MASCOTE_LARGURA}
        height={MASCOTE_ALTURA}
        isInteractive={prefs.mascote === 'animado'}
      />
    </Box>
  )
}

type Acoes = { ocultar: () => unknown; ajustes?: () => unknown }

export function banda(ui: Ui, superficie: string, colunas: number, c: Contexto, acoes: Acoes, outros: RenderElement): RenderElement {
  const { Box, Text, Button } = ui
  const trechos = trechosDaBanda(c)
  const custo = custoCurto(c)
  const comMascote = c.prefs.mascote !== 'oculto'
  const { w, resto, comExtra, cabeca, mostrar } = encaixe(colunas, { glifo: comMascote ? MASCOTE_TEXTO.length + 1 : 0, modelo: c.l.modelo.length, custo: custo.length }, trechos)
  const comModelo = cabeca !== 'nada'
  const comGlifo = cabeca === 'toda' || cabeca === 'sem-custo'
  const comCusto = cabeca === 'toda'

  // Fora do terminal a fonte é proporcional: contar caracteres não fecha a largura.
  // Ali cada barra é um bloco flexível, e as barras dividem por igual o que sobra da linha.
  // O trilho não tem conteúdo (senão barras com e sem preenchimento saem de larguras diferentes)
  // e o preenchimento é uma fração exata dele. Meia linha de altura acompanha a altura das letras.
  if (superficie !== 'terminal') {
    const medidor = (x: Trecho) => {
      const p = x.pct === null ? 0 : Math.round(Math.max(0, Math.min(100, x.pct)))
      return (
        <Box key={x.rotulo} flexDirection="row" flexGrow={1} alignItems="center" columnGap={1}>
          <Text dimColor>{x.rotulo}</Text>
          <Box flexDirection="row" flexGrow={1} height={0.5} backgroundColor={TRILHO} overflow="hidden">
            {p > 0 && <Box key="cheio" width={`${p}%`} backgroundColor={corDe(x.pct)} />}
          </Box>
          <Text color={corDe(x.pct)}>{pctTexto(x.pct)}</Text>
          {comExtra && x.extra !== '' && <Text dimColor>{x.extra}</Text>}
        </Box>
      )
    }
    const grafico = mascoteGrafico(ui, c.prefs)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" width={colunas} columnGap={2} paddingLeft={1}>
          <Box flexDirection="row" alignItems="center">
            {grafico ?? (comMascote && mascoteTexto(ui))}
            <Text bold>{c.l.modelo}</Text>
            {custo !== '' && <Text dimColor>{custo}</Text>}
          </Box>
          {trechos.map(medidor)}
          {acoes.ajustes !== undefined && <Button key="ajustes" label="⚙" plain onPress={acoes.ajustes} />}
          <Button key="ocultar" label="×" plain role="dismiss" onPress={acoes.ocultar} />
        </Box>
        {outros}
      </Box>
    )
  }

  const trecho = (x: Trecho, i: number) => {
    // Sem barras, o trecho fica compacto: rótulo, um espaço e o percentual.
    if (w === 0) {
      return (
        <Box key={x.rotulo} flexDirection="row">
          <Text dimColor>{`${' '.repeat(SEP_COMPACTO)}${x.rotulo} `}</Text>
          <Text color={x.pct === null ? undefined : corDe(x.pct)} dimColor={x.pct === null}>{pctTexto(x.pct)}</Text>
        </Box>
      )
    }
    const largura = w + (i < resto ? 1 : 0)
    const b = barra(x.pct, largura)
    const pct = pctTexto(x.pct)
    // O número encosta na barra dele; o que falta das 4 colunas do percentual vai para o fim do trecho,
    // depois do detalhe, junto do espaço que separa do próximo rótulo.
    return (
      <Box key={x.rotulo} flexDirection="row">
        <Text dimColor>{`${' '.repeat(SEP_BARRAS)}${x.rotulo} `}</Text>
        {x.pct === null && <Text dimColor>{SEM_LEITURA.repeat(largura)}</Text>}
        {b.cheio !== '' && <Text backgroundColor={corDe(x.pct)}>{b.cheio}</Text>}
        {b.vazio !== '' && <Text backgroundColor="subtle">{b.vazio}</Text>}
        <Text color={x.pct === null ? undefined : corDe(x.pct)} dimColor={x.pct === null}>{` ${pct}`}</Text>
        {comExtra && x.extra !== '' && <Text dimColor>{` ${x.extra}`}</Text>}
        {pct.length < PCT_COLUNAS && <Text>{' '.repeat(PCT_COLUNAS - pct.length)}</Text>}
      </Box>
    )
  }
  // Alinhada à esquerda com uma coluna de margem, como o resto do Claude Code. O × fica discreto:
  // cheio só sob o ponteiro ou o foco, ao lado do [-] que o Claude Code desenha.
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" width={colunas} paddingLeft={1}>
        {comGlifo && comMascote && mascoteTexto(ui)}
        {comModelo && <Text bold>{c.l.modelo}</Text>}
        {comCusto && custo !== '' && <Text dimColor>{custo}</Text>}
        {trechos.slice(0, mostrar).map(trecho)}
        <Text> </Text>
        <Button key="ocultar" label="×" plain dimColor role="dismiss" onPress={acoes.ocultar} />
      </Box>
      {outros}
    </Box>
  )
}
