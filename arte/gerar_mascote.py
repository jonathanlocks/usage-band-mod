"""Gera o mascote animado do usage-band-mod: um SVG só, com a rotação de gestos em SMIL.

Fan art em pixel do Clawd, o mascote do Claude Code (personagem da Anthropic), desenhada
quadro a quadro neste arquivo: corpo de 16x10 num palco de 24x14, com espaço para chapéu,
Zzz e passos para os lados. Não usa nenhum arquivo da Anthropic.

Saídas:
  ../hooks/mascote.ts  o SVG animado e o parado como constantes, que o mod importa
  mascote-animado.svg  o SVG animado em arquivo (usado no README)
  previa.html          só com --previa: a banda em tamanho real, ampliada e cada gesto

Uso: python3 gerar_mascote.py [--previa] [--docs] [--check]
  --docs   também grava docs/gestures/<gesto>.svg, um por gesto, para o README
  --check  não grava nada; sai com erro se hooks/mascote.ts não bate com o gerado
"""
import html
import json
import os
import sys
import random

W, H = 24, 14          # palco em pixels de arte
OX, OY = 4, 2          # canto do Clawd parado: 2 linhas livres em cima e 2 embaixo, corpo no meio do palco
QUADRO = 120           # ms por quadro, salvo onde o gesto pede outro

CORPO = '#D87656'
OLHO = '#141413'
CINZA = '#8B8B8B'
CINZA_ESC = '#5E5D59'
MARFIM = '#F9F8F4'
AMARELO = '#E8B93C'
AZUL = '#5B8DEF'
ROSA = '#E25C6B'
VERDE = '#5DBB63'


# ---------- peças ----------

def ret(px, cor, x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[(x, y)] = cor


OLHOS = {
    'aberto': [(4, 2), (4, 3), (11, 2), (11, 3)],
    'piscando': [(4, 3), (11, 3)],
    'esquerda': [(3, 2), (3, 3), (10, 2), (10, 3)],
    'direita': [(5, 2), (5, 3), (12, 2), (12, 3)],
    'cima': [(4, 1), (4, 2), (11, 1), (11, 2)],
    'baixo': [(4, 3), (4, 4), (11, 3), (11, 4)],
    'feliz': [(3, 3), (4, 2), (5, 3), (10, 3), (11, 2), (12, 3)],
    'dormindo': [(3, 3), (4, 3), (5, 3), (10, 3), (11, 3), (12, 3)],
    'arregalado': [(3, 2), (4, 2), (3, 3), (4, 3), (11, 2), (12, 2), (11, 3), (12, 3)],
}

BRACOS = {
    'normal': [(0, 4, 1, 5), (14, 4, 15, 5)],
    'esq_cima': [(0, 2, 1, 3), (14, 4, 15, 5)],
    'dir_cima': [(0, 4, 1, 5), (14, 2, 15, 3)],
    'dir_alto': [(0, 4, 1, 5), (15, 1, 16, 2)],
    'dois_cima': [(0, 2, 1, 3), (14, 2, 15, 3)],
    'baixo': [(0, 6, 1, 7), (14, 6, 15, 7)],
    'esq_baixo': [(0, 6, 1, 7), (14, 4, 15, 5)],
    'dir_baixo': [(0, 4, 1, 5), (14, 6, 15, 7)],
    'segura': [(0, 4, 1, 5), (14, 3, 15, 4)],
    'gole': [(0, 4, 1, 5), (14, 1, 15, 2)],
}

PERNAS = {
    'normal': [(3, 8, 9), (5, 8, 9), (10, 8, 9), (12, 8, 9)],
    'passo_a': [(3, 8, 8), (5, 8, 8), (10, 8, 8), (12, 8, 8), (2, 9, 9), (4, 9, 9), (9, 9, 9), (11, 9, 9)],
    'passo_b': [(3, 8, 8), (5, 8, 8), (10, 8, 8), (12, 8, 8), (4, 9, 9), (6, 9, 9), (11, 9, 9), (13, 9, 9)],
    'encolhida': [(3, 8, 8), (5, 8, 8), (10, 8, 8), (12, 8, 8)],
}


def clawd(dx=0, dy=0, olhos='aberto', bracos='normal', pernas='normal'):
    px = {}
    ox, oy = OX + dx, OY + dy
    ret(px, CORPO, ox + 2, ox + 13, oy, oy + 7)
    for x0, y0, x1, y1 in BRACOS[bracos]:
        ret(px, CORPO, ox + x0, ox + x1, oy + y0, oy + y1)
    for x, y0, y1 in PERNAS[pernas]:
        ret(px, CORPO, ox + x, ox + x, oy + y0, oy + y1)
    for x, y in OLHOS[olhos]:
        px[(ox + x, oy + y)] = OLHO
    return px


def por_cima(base, *camadas):
    px = dict(base)
    for c in camadas:
        px.update(c)
    return px


def forma(desenho, x, y, cor):
    """Desenho em texto: '#' pinta, qualquer outra coisa deixa vazio."""
    px = {}
    for j, linha in enumerate(desenho):
        for i, ch in enumerate(linha):
            if ch == '#':
                px[(x + i, y + j)] = cor
    return px


Z = ['###', '.#.', '###']
Z_PEQ = ['##', '##']
CORACAO = ['.#.#.', '#####', '.###.', '..#..']
CORACAO_PEQ = ['#.#', '###', '.#.']
MAIS = ['.#.', '###', '.#.']
VEZES = ['#.#', '.#.', '#.#']
NOTA = ['.#', '.#', '##']


def oculos(dy_oculos, brilho=None, dx=0, dy=0):
    ox, oy = OX + dx, OY + dy + dy_oculos
    px = {}
    ret(px, OLHO, ox + 3, ox + 12, oy + 2, oy + 2)
    ret(px, OLHO, ox + 3, ox + 6, oy + 3, oy + 3)
    ret(px, OLHO, ox + 9, ox + 12, oy + 3, oy + 3)
    if brilho is not None:
        px[(ox + brilho, oy + 2)] = MARFIM
    return px


def chapeu(dx=0, dy=0):
    ox, oy = OX + dx, OY + dy
    px = {}
    # Chapéu baixo, de duas linhas: cabe na folga de cima do palco.
    ret(px, AMARELO, ox + 5, ox + 10, oy - 1, oy - 1)
    ret(px, AZUL, ox + 6, ox + 9, oy - 2, oy - 2)
    px[(ox + 7, oy - 2)] = MARFIM
    return {k: v for k, v in px.items() if k[1] >= 0}


def laptop():
    px = {}
    ret(px, CINZA, OX + 3, OX + 12, OY + 5, OY + 8)
    px[(OX + 7, OY + 6)] = MARFIM
    px[(OX + 8, OY + 6)] = MARFIM
    ret(px, CINZA_ESC, OX + 1, OX + 14, OY + 9, OY + 9)
    return px


def caneca(levantada=False, vapor=0):
    y = OY + 0 if levantada else OY + 2
    x = OX + 15
    px = {}
    ret(px, MARFIM, x + 1, x + 3, y, y + 2)
    px[(x + 4, y + 1)] = MARFIM
    if not levantada:
        for i, (vx, vy) in enumerate([(x + 2, y - 2), (x + 3, y - 3), (x + 2, y - 4)]):
            if (i + vapor) % 2 == 0 and vy >= 0:
                px[(vx, vy)] = CINZA
    return px


# ---------- gestos: listas de (quadro, ms) ----------

def parado(ms):
    return [(clawd(), ms)]


def piscar():
    return [(clawd(olhos='piscando'), 150)]


def g_olhar():
    return [(clawd(olhos='esquerda'), 700), (clawd(), 200), (clawd(olhos='direita'), 700),
            (clawd(), 200), (clawd(olhos='cima'), 500), (clawd(), 100)]


def g_pulinho():
    q = []
    for _ in range(2):
        for dy, pernas in [(0, 'normal'), (-1, 'encolhida'), (-2, 'encolhida'), (-2, 'encolhida'),
                           (-2, 'encolhida'), (-1, 'encolhida'), (0, 'normal')]:
            q.append((clawd(dy=dy, olhos='feliz', pernas=pernas, bracos='dois_cima' if dy < -1 else 'normal'), 70))
        q.append((clawd(olhos='feliz'), 160))
    return q


def g_laptop():
    q = [(por_cima(clawd(olhos='baixo'), laptop()), 300)]
    for i in range(12):
        q.append((por_cima(clawd(olhos='baixo', bracos='esq_baixo' if i % 2 else 'dir_baixo'), laptop()), 110))
    q.append((por_cima(clawd(olhos='piscando'), laptop()), 150))
    for i in range(8):
        q.append((por_cima(clawd(olhos='baixo', bracos='esq_baixo' if i % 2 else 'dir_baixo'), laptop()), 110))
    q.append((por_cima(clawd(olhos='feliz'), laptop()), 600))
    return q


def g_acenar():
    q = [(clawd(olhos='feliz', bracos='dir_cima'), 200)]
    for i in range(6):
        q.append((clawd(olhos='feliz', bracos='dir_alto' if i % 2 == 0 else 'dir_cima'), 160))
    q.append((clawd(olhos='feliz'), 200))
    return q


def g_caranguejo():
    trilha = [0, 1, 1, 2, 2, 3, 3, 3, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -3, -3, -3, -2, -2, -1, -1, 0]
    q = []
    for i, dx in enumerate(trilha):
        olhos = 'direita' if i < 7 else 'esquerda' if i < 20 else 'direita'
        q.append((clawd(dx=dx, olhos=olhos, pernas='passo_a' if i % 2 == 0 else 'passo_b'), 110))
    q.append((clawd(), 150))
    return q


def g_coracao():
    q = [(clawd(olhos='feliz'), 250)]
    # O coração sobe ao lado da cabeça, à direita, onde o palco tem folga.
    for y in [4, 3, 2, 1, 0]:
        q.append((por_cima(clawd(olhos='feliz'), forma(CORACAO_PEQ, OX + 16, y, ROSA)), 150))
    for _ in range(2):
        q.append((por_cima(clawd(olhos='feliz'), forma(CORACAO, OX + 15, 0, ROSA)), 260))
        q.append((por_cima(clawd(olhos='feliz'), forma(CORACAO_PEQ, OX + 16, 0, ROSA)), 200))
    q.append((clawd(olhos='feliz'), 300))
    return q


def g_ideia():
    q = [(clawd(olhos='cima'), 300)]
    for i in range(8):
        q.append((por_cima(clawd(olhos='cima'), forma(MAIS if i % 2 == 0 else VEZES, OX + 16, 0, AMARELO)), 160))
    q.append((por_cima(clawd(olhos='arregalado', bracos='dir_cima'), forma(MAIS, OX + 16, 0, AMARELO)), 500))
    q.append((clawd(olhos='feliz', bracos='dir_cima'), 400))
    return q


def g_oculos():
    q = []
    for d in [-4, -3, -2, -1]:
        q.append((por_cima(clawd(olhos='cima'), oculos(d)), 140))
    q.append((por_cima(clawd(), oculos(0)), 300))
    for b in [3, 5, 9, 11]:
        q.append((por_cima(clawd(), oculos(0, brilho=b)), 90))
    q.append((por_cima(clawd(bracos='dir_cima'), oculos(0)), 900))
    q.append((por_cima(clawd(), oculos(0)), 400))
    for d in [-1, -2, -3, -4]:
        q.append((por_cima(clawd(olhos='feliz'), oculos(d)), 110))
    q.append((clawd(olhos='feliz'), 200))
    return q


def g_cafe():
    q = []
    for i in range(6):
        q.append((por_cima(clawd(bracos='segura'), caneca(vapor=i)), 220))
    q.append((por_cima(clawd(olhos='piscando', bracos='gole'), caneca(levantada=True)), 800))
    for i in range(4):
        q.append((por_cima(clawd(olhos='feliz', bracos='segura'), caneca(vapor=i)), 220))
    return q


def g_danca():
    q = []
    notas = [forma(NOTA, 1, 0, CINZA), forma(NOTA, 21, 1, CINZA)]
    for i in range(16):
        lado = i % 2
        q.append((por_cima(clawd(dx=-1 if lado == 0 else 1, dy=0 if i % 4 < 2 else -1, olhos='feliz',
                                 bracos='esq_cima' if lado == 0 else 'dir_cima',
                                 pernas='passo_a' if lado == 0 else 'passo_b'), notas[(i // 2) % 2]), 180))
    q.append((clawd(olhos='feliz', bracos='dois_cima'), 300))
    return q


def g_esconde():
    q = []
    for dy in [1, 2, 3, 4, 5, 6]:
        q.append((clawd(dy=dy, olhos='arregalado'), 90))
    q.append((clawd(dy=6, olhos='esquerda'), 600))
    q.append((clawd(dy=6, olhos='direita'), 600))
    q.append((clawd(dy=6, olhos='piscando'), 150))
    q.append((clawd(dy=6), 300))
    for dy in [3, 0, -2, -3, -2, 0]:
        q.append((clawd(dy=dy, olhos='feliz', pernas='encolhida' if dy < 0 else 'normal', bracos='dois_cima' if dy < 0 else 'normal'), 80))
    q.append((clawd(olhos='feliz'), 300))
    return q


def g_dormir():
    q = [(clawd(olhos='piscando'), 300), (clawd(olhos='dormindo'), 400)]
    zs = [(19, 3, Z_PEQ), (20, 2, Z_PEQ), (20, 1, Z), (21, 0, Z)]
    for volta in range(3):
        for i, (x, y, f) in enumerate(zs):
            camada = forma(f, x, y, CINZA)
            if i > 1:
                camada = por_cima(forma(Z_PEQ, 19, 3, CINZA), camada)
            q.append((por_cima(clawd(olhos='dormindo', pernas='normal'), camada), 260))
    q.append((clawd(olhos='piscando'), 250))
    q.append((clawd(olhos='arregalado'), 300))
    return q


def g_festa():
    rnd = random.Random(7)
    cores = [AMARELO, AZUL, ROSA, VERDE, MARFIM]
    pecas = [[rnd.randrange(W), rnd.randrange(-H, 0), rnd.choice(cores)] for _ in range(14)]
    q = [(por_cima(clawd(olhos='arregalado'), chapeu()), 250)]
    for i in range(16):
        confete = {}
        for p in pecas:
            p[1] += 1
            if 0 <= p[1] < H:
                confete[(p[0], p[1])] = p[2]
        # Sem pulo: o chapéu já ocupa as duas linhas de cima do palco e seria cortado.
        pulo = 0
        corpo = clawd(dy=pulo, olhos='feliz', bracos='dois_cima' if i % 2 == 0 else 'normal',
                      pernas='encolhida' if pulo else 'normal')
        q.append((por_cima(confete, corpo, chapeu(dy=pulo)), 130))
    q.append((por_cima(clawd(olhos='feliz'), chapeu()), 500))
    return q


GESTOS = [
    ('olhar', 'Olha para os lados e para cima', g_olhar),
    ('pulinho', 'Dois pulinhos de braço para cima', g_pulinho),
    ('laptop', 'Digita num laptop e fica satisfeito', g_laptop),
    ('acenar', 'Acena com o braço', g_acenar),
    ('caranguejo', 'Anda de lado, vai e volta', g_caranguejo),
    ('coracao', 'Solta um coração', g_coracao),
    ('ideia', 'Tem uma ideia (estrela piscando)', g_ideia),
    ('oculos', 'Óculos escuros descem, brilham e sobem', g_oculos),
    ('cafe', 'Toma um gole de café', g_cafe),
    ('danca', 'Dança com notas musicais', g_danca),
    ('esconde', 'Some para baixo, espia e volta num pulo', g_esconde),
    ('dormir', 'Cochila com Zzz e acorda assustado', g_dormir),
    ('festa', 'Chapéu de festa e confete', g_festa),
]


ROTULOS = {'olhar': 'Olhar', 'pulinho': 'Pulinho', 'laptop': 'Laptop', 'acenar': 'Acenar', 'caranguejo': 'Caranguejo',
           'coracao': 'Coração', 'ideia': 'Ideia', 'oculos': 'Óculos', 'cafe': 'Café', 'danca': 'Dança',
           'esconde': 'Esconde-esconde', 'dormir': 'Cochilo', 'festa': 'Festa'}


def intervalo():
    """Pausa entre gestos: parado, com uma piscada no meio. Curta para o ciclo ficar abaixo de
    60 s: a banda se redesenha a cada minuto, e um ciclo maior podia nunca chegar ao fim."""
    return parado(700) + piscar() + parado(700)


def ciclo(gestos):
    linha = []
    for _, _, fn in gestos:
        linha += intervalo() + fn()
    return linha


# ---------- SVG ----------

def caminho(px, cor):
    """Pixels de uma cor viram retângulos horizontais num path."""
    linhas = {}
    for (x, y), c in px.items():
        if c == cor and 0 <= x < W and 0 <= y < H:
            linhas.setdefault(y, []).append(x)
    d = []
    for y in sorted(linhas):
        xs = sorted(linhas[y])
        ini = ant = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == ant + 1:
                ant = x
                continue
            d.append(f'M{ini} {y}h{ant - ini + 1}v1h{-(ant - ini + 1)}z')
            if x is not None:
                ini = ant = x
    return ''.join(d)


def desenho(px):
    cores = sorted({c for c in px.values()})
    return ''.join(f'<path fill="{c}" d="{caminho(px, c)}"/>' for c in cores if caminho(px, c))


def svg(linha, largura=36, altura=21):
    total = sum(ms for _, ms in linha)
    chave = lambda px: tuple(sorted(px.items()))
    quadros, ordem = {}, []
    t = 0
    for px, ms in linha:
        k = chave(px)
        if k not in quadros:
            quadros[k] = (px, [])
            ordem.append(k)
        quadros[k][1].append((t, t + ms))
        t += ms
    estatico = desenho(clawd())
    grupos = []
    for k in ordem:
        px, trechos = quadros[k]
        tempos, valores = [0.0], ['0']
        for a, b in trechos:
            if a == 0:
                valores[0] = '1'
            else:
                tempos.append(a / total); valores.append('1')
            if b < total:
                tempos.append(b / total); valores.append('0')
        # junta trechos vizinhos do mesmo quadro
        t2, v2 = [tempos[0]], [valores[0]]
        for tt, vv in zip(tempos[1:], valores[1:]):
            if vv == v2[-1]:
                continue
            t2.append(tt); v2.append(vv)
        kt = ';'.join(f'{x:.5f}'.rstrip('0').rstrip('.') if x else '0' for x in t2)
        grupos.append(f'<g opacity="{v2[0]}">{desenho(px)}'
                      f'<animate attributeName="opacity" calcMode="discrete" dur="{total / 1000:g}s" '
                      f'repeatCount="indefinite" values="{";".join(v2)}" keyTimes="{kt}"/></g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{largura}" height="{altura}" viewBox="0 0 {W} {H}" '
            f'shape-rendering="crispEdges"><style>.e{{display:none}}@media (prefers-reduced-motion:reduce)'
            f'{{.a{{display:none}}.e{{display:inline}}}}</style><g class="e">{estatico}</g>'
            f'<g class="a">{"".join(grupos)}</g></svg>'), total


# ---------- prévia ----------

def previa(svg_ciclo, total, por_gesto):
    def img(s, w, h, cls=''):
        return f'<img class="{cls}" width="{w}" height="{h}" alt="Clawd animado" src="data:image/svg+xml;charset=utf-8,{html.escape(s.replace("#", "%23"), quote=True)}">'
    grande = svg_ciclo.replace('width="36" height="21"', 'width="288" height="168"')
    cartoes = ''.join(
        f'<figure><div class="palco">{img(s, 192, 112)}</div>'
        f'<figcaption><b>{i}. {html.escape(ROTULOS.get(nome, nome))}</b><span>{html.escape(desc)}</span><small>{ms / 1000:.1f} s</small></figcaption></figure>'
        for i, (nome, desc, s, ms) in enumerate(por_gesto, 1))

    def banda(tema):
        return (f'<div class="banda {tema}">{img(svg_ciclo, 36, 21)}<b>Opus 5.5</b><span class="m">· R$ 24,02</span>'
                + ''.join(f'<span class="m">{r}</span><i><em style="width:{p}%"></em></i><span class="v">{p}%</span>'
                          for r, p in [('Contexto', 24), ('5h', 5), ('7d', 1), ('Fable', 0)])
                + '<span class="m x">×</span></div>')
    return f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clawd animado</title><style>
:root{{--bg:#faf9f5;--ink:#141413;--mute:#6b6a65;--line:#e6e3da;--panel:#fff}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#151514;--ink:#f3f1ea;--mute:#a19f97;--line:#2e2d2a;--panel:#1e1e1c}}}}
:root[data-theme="dark"]{{--bg:#151514;--ink:#f3f1ea;--mute:#a19f97;--line:#2e2d2a;--panel:#1e1e1c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Inter",sans-serif}}
.wrap{{max-width:1100px;margin:0 auto;padding:40px 16px 80px}}h1{{margin:0 0 6px;font-size:32px;letter-spacing:-.02em}}h2{{margin:36px 0 10px;font-size:20px}}
p{{color:var(--mute);margin:0 0 12px;max-width:760px}}
img{{image-rendering:pixelated;display:block}}
.banda{{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:12px;font-size:14px;overflow:hidden;white-space:nowrap;margin-bottom:10px}}
.banda.escura{{background:#262624;color:#f3f1ea}}.banda.clara{{background:#f0eee6;color:#141413;border:1px solid #e0ddd3}}
.banda .m{{opacity:.6}}.banda i{{flex:1;min-width:30px;height:9px;background:#8b8b8b;opacity:.9;display:block}}.banda em{{display:block;height:100%;background:#4caf50}}
.banda .v{{color:#4caf50}}.banda .x{{margin-left:6px}}
.grande{{background:#262624;border-radius:12px;padding:24px;display:inline-block}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}}
figure{{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.palco{{background:#262624;display:flex;justify-content:center;padding:14px}}
figcaption{{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px}}figcaption span{{color:var(--mute);font-size:14px}}figcaption small{{color:var(--mute)}}
</style></head><body><div class="wrap">
<h1>Clawd animado</h1>
<p>Prévia para a banda do usage-band-mod. É um SVG só, de {len(svg_ciclo) // 1024} KB, com {len(por_gesto)} gestos em sequência e uma pausa com piscada entre eles. O ciclo inteiro dura {total / 1000:.0f} s e recomeça. Arte própria em pixel, no grid do mascote do mod.</p>
<h2>Na banda, tamanho real</h2>
{banda("escura")}{banda("clara")}
<h2>Ampliado (8×)</h2>
<div class="grande">{img(grande, 288, 168)}</div>
<h2>Cada gesto</h2>
<p>Cada um em loop, para olhar com calma. Diga quais tirar, trocar ou acrescentar.</p>
<div class="grid">{cartoes}</div>
</div></body></html>'''


def modulo_ts(animado, parado, total):
    return ('// Gerado por arte/gerar_mascote.py; não edite à mão.\n'
            f'// Fan art do Clawd: {len(GESTOS)} gestos em SMIL, ciclo de {total / 1000:.1f} s, palco de {W}x{H} pixels de arte.\n'
            f'export const MASCOTE_ANIMADO = {json.dumps(animado, ensure_ascii=False)}\n'
            f'export const MASCOTE_PARADO = {json.dumps(parado, ensure_ascii=False)}\n'
            'export const MASCOTE_LARGURA = 36\nexport const MASCOTE_ALTURA = 21\n')


def main():
    aqui = os.path.dirname(os.path.abspath(__file__))
    s, total = svg(ciclo(GESTOS))
    estatico = (f'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="21" viewBox="0 0 {W} {H}" '
                f'shape-rendering="crispEdges">{desenho(clawd())}</svg>')
    ts = modulo_ts(s, estatico, total)
    destino = os.path.join(aqui, '..', 'hooks', 'mascote.ts')
    if '--check' in sys.argv:
        atual = open(destino, encoding='utf-8').read() if os.path.exists(destino) else ''
        if atual != ts:
            print('hooks/mascote.ts está desatualizado: rode python3 arte/gerar_mascote.py')
            sys.exit(1)
        print('hooks/mascote.ts confere com o gerador')
        return
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(ts)
    with open(os.path.join(aqui, 'mascote-animado.svg'), 'w', encoding='utf-8') as f:
        f.write(s)
    if '--docs' in sys.argv:
        # Um SVG por gesto, em loop, para o README (docs/gestures/<nome>.svg).
        pasta = os.path.join(aqui, '..', 'docs', 'gestures')
        os.makedirs(pasta, exist_ok=True)
        for nome, _, fn in GESTOS:
            sg, _ = svg(parado(500) + fn(), 96, 56)
            with open(os.path.join(pasta, f'{nome}.svg'), 'w', encoding='utf-8') as f:
                f.write(sg)
    if '--previa' in sys.argv:
        por_gesto = []
        for nome, desc, fn in GESTOS:
            sg, _ = svg(parado(600) + fn(), 192, 112)
            por_gesto.append((nome, desc, sg, sum(m for _, m in fn())))
        with open(os.path.join(aqui, 'previa.html'), 'w', encoding='utf-8') as f:
            f.write(previa(s, total, por_gesto))
    print(f'mascote.ts: animado com {len(s)} caracteres (limite do Svg: 131072), ciclo de {total / 1000:.1f} s')


if __name__ == '__main__':
    main()
