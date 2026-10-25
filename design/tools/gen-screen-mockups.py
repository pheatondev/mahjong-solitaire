# Generates design/screens/*.svg — GDD §9.3/§9.4 screen mockups on the locked 390x844 stage
import os

W_TILE, H_TILE = 112, 140          # local tile coordinate space (scale applied per placement)
INK = '#4a2b3a'
ACCENT = '#ff5d8f'
KEY = {'d': '#4aa3ff', 'b': '#3ec46d', 'c': '#ff4d4d', 'w': '#7a5cff', 'dr': '#ff4d4d', 'dg': '#3ec46d', 'dw': '#8fd7ff'}
SEQ = ['dr', 'd2', 'wE', 'b1', 'c7', 'dg', 'wW', 'd1', 'b2', 'c5', 'd3', 'c9', 'b3', 'd4', 'wS', 'wN']
NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
WIND = {'E': 0, 'S': 90, 'W': 180, 'N': 270}

DEFS = '''<defs>
<linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f8efdd"/></linearGradient>
<radialGradient id="dotg" cx="0.35" cy="0.3" r="1"><stop offset="0" stop-color="#9ed6ff"/><stop offset="0.55" stop-color="#3f9bea"/><stop offset="1" stop-color="#1f74c0"/></radialGradient>
<linearGradient id="bamg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3a0"/><stop offset="1" stop-color="#2fa55e"/></linearGradient>
<linearGradient id="pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7ba6"/><stop offset="1" stop-color="#ff5d8f"/></linearGradient>
<linearGradient id="skg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9e8"/><stop offset="1" stop-color="#ffadc6"/></linearGradient>
<clipPath id="faceclip"><rect x="4" y="4" width="104" height="132" rx="22"/></clipPath>
<filter id="cs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#4a2b3a" flood-opacity="0.4"/></filter>
<filter id="bs" x="-30%" y="-60%" width="160%" height="240%"><feDropShadow dx="0" dy="5" stdDeviation="0" flood-color="#e14b7c" flood-opacity="0.55"/></filter>
<filter id="bs2" x="-30%" y="-60%" width="160%" height="240%"><feDropShadow dx="0" dy="4" stdDeviation="0" flood-color="#e5c6d4" flood-opacity="0.8"/></filter>
<filter id="desat"><feColorMatrix type="saturate" values="0"/></filter>
</defs>'''


def sky():
    p = ['<rect width="390" height="844" fill="url(#skg)"/>']
    p.append('<ellipse cx="30" cy="170" rx="70" ry="20" fill="#ffffff" opacity="0.45"/>')
    p.append('<ellipse cx="330" cy="600" rx="60" ry="17" fill="#ffffff" opacity="0.4"/>')
    p.append('<ellipse cx="150" cy="430" rx="46" ry="13" fill="#ffffff" opacity="0.3"/>')
    for sx, sy in [(300, 120), (60, 330), (340, 730), (40, 780)]:
        p.append(f'<text x="{sx}" y="{sy}" font-size="13" fill="#ffffff" opacity="0.8">✦</text>')
    return ''.join(p)


# ---------- tile drawing (local 112x140 space, scaled at placement) ----------

def shell_l(key):
    p = [f'<rect x="0" y="6" width="{W_TILE}" height="{H_TILE}" rx="26" fill="#d9c2a4"/>',
         f'<rect x="0" y="0" width="{W_TILE}" height="{H_TILE}" rx="26" fill="url(#ivory)" stroke="#e6d2b6" stroke-width="1.5"/>',
         f'<rect x="4" y="4" width="{W_TILE-8}" height="{H_TILE-8}" rx="22" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2"/>']
    if key:
        p.append(f'<rect x="14" y="{H_TILE-21}" width="{W_TILE-28}" height="5" rx="2.5" fill="{key}"/>')
    return ''.join(p)


def dots_l(rank):
    L = {1: [((0, 0), 15)], 2: [((0, -20), 11), ((0, 20), 11)], 3: [((-22, -20), 11), ((0, 0), 11), ((22, 20), 11)],
         4: [((-24, -19), 11), ((24, -19), 11), ((-24, 19), 11), ((24, 19), 11)],
         5: [((-24, -19), 11), ((24, -19), 11), ((0, 0), 11), ((-24, 19), 11), ((24, 19), 11)],
         6: [((-22, -23), 10), ((22, -23), 10), ((-22, 0), 10), ((22, 0), 10), ((-22, 23), 10), ((22, 23), 10)],
         7: [((-30, -26), 10), ((0, -26), 10), ((30, -26), 10), ((-16, 9), 10), ((16, 9), 10), ((-16, 35), 10), ((16, 35), 10)],
         8: [((-22, -27), 9), ((22, -27), 9), ((-22, -9), 9), ((22, -9), 9), ((-22, 9), 9), ((22, 9), 9), ((-22, 27), 9), ((22, 27), 9)],
         9: [((dx, dy), 9) for dx in (-30, 0, 30) for dy in (-27, 0, 27)]}[rank]
    p = []
    for (dx, dy), r in L:
        p.append(f'<circle cx="{56+dx}" cy="{66+dy}" r="{r}" fill="url(#dotg)"/>')
        p.append(f'<circle cx="{56+dx-r*0.28:.1f}" cy="{66+dy-r*0.34:.1f}" r="{r*0.30:.1f}" fill="#ffffff" opacity="0.75"/>')
    return ''.join(p)


def bam_l(rank):
    if rank == 1:
        return '<text x="56" y="80" font-family="Segoe UI Emoji, sans-serif" font-size="46" text-anchor="middle">🐦</text>'
    L = {2: [(0, -20), (0, 20)], 3: [(-22, -20), (0, 0), (22, 20)],
         4: [(-24, -19), (24, -19), (-24, 19), (24, 19)],
         5: [(-24, -19), (24, -19), (0, 0), (-24, 19), (24, 19)],
         6: [(-22, -23), (22, -23), (-22, 0), (22, 0), (-22, 23), (22, 23)],
         7: [(-30, -26), (0, -26), (30, -26), (-16, 9), (16, 9), (-16, 35), (16, 35)],
         8: [(-22, -27), (22, -27), (-22, -9), (22, -9), (-22, 9), (22, 9), (-22, 27), (22, 27)],
         9: [(dx, dy) for dx in (-30, 0, 30) for dy in (-27, 0, 27)]}[rank]
    p = []
    for dx, dy in L:
        cx, cy = 56 + dx, 66 + dy
        p.append(f'<rect x="{cx-4.5:.1f}" y="{cy-12}" width="9" height="24" rx="4.5" fill="url(#bamg)"/>')
        p.append(f'<line x1="{cx-4.5:.1f}" x2="{cx+4.5:.1f}" y1="{cy-4}" y2="{cy-4}" stroke="#2f9e57" stroke-width="1.6"/>')
        p.append(f'<line x1="{cx-4.5:.1f}" x2="{cx+4.5:.1f}" y1="{cy+4}" y2="{cy+4}" stroke="#2f9e57" stroke-width="1.6"/>')
    return ''.join(p)


def chars_l(rank):
    return (f'<text x="56" y="56" font-size="36" font-weight="700" fill="#c23a4d" text-anchor="middle">{NUM[rank-1]}</text>'
            f'<text x="56" y="102" font-size="30" font-weight="700" fill="#c23a4d" text-anchor="middle">萬</text>')


def wind_l(letter):
    cx, cy = 56, 94
    return (f'<text x="56" y="64" font-size="42" font-weight="800" fill="#5a43a8" text-anchor="middle">{letter}</text>'
            f'<g transform="rotate({WIND[letter]} {cx} {cy})">'
            f'<path d="M {cx} {cy-12} L {cx+5} {cy} L {cx-5} {cy} Z" fill="#e05a5a"/>'
            f'<path d="M {cx} {cy+12} L {cx+5} {cy} L {cx-5} {cy} Z" fill="#ffffff" stroke="#b9a3b6" stroke-width="1"/>'
            f'<circle cx="{cx}" cy="{cy}" r="2.4" fill="#5a43a8"/></g>')


def drag_l(char, ink):
    return (f'<rect x="10" y="10" width="92" height="120" rx="16" fill="none" stroke="{ink}" stroke-width="2.5" stroke-opacity="0.85"/>'
            f'<text x="56" y="88" font-size="52" font-weight="800" fill="{ink}" text-anchor="middle">{char}</text>')


def white_drag_l():
    return ('<rect x="12" y="12" width="88" height="116" rx="14" fill="none" stroke="#8fd7ff" stroke-width="4"/>'
            '<rect x="20" y="20" width="72" height="100" rx="10" fill="none" stroke="#8fd7ff" stroke-width="1.5" stroke-opacity="0.6"/>')


def back_l():
    p = ['<rect x="0" y="6" width="112" height="140" rx="26" fill="#d9c2a4"/>',
         '<rect x="0" y="0" width="112" height="140" rx="26" fill="#fff1f6" stroke="#e6d2b6" stroke-width="1.5"/>',
         '<g clip-path="url(#faceclip)"><g transform="rotate(-16 56 70)">']
    for i in range(-3, 7):
        p.append(f'<rect x="{i*30-40}" y="-60" width="14" height="260" fill="{["#ffdce9", "#ffc3d8"][i % 2]}"/>')
    p.append('</g></g><text x="92" y="124" font-family="Segoe UI Emoji, sans-serif" font-size="17" fill="#ff5d8f">✦</text>')
    return ''.join(p)


def tile(kind, x, y, w, dim=False):
    s = w / W_TILE
    key, content = None, ''
    if kind == 'dw':
        key, content = KEY['dw'], white_drag_l()
    elif kind == 'dr':
        key = KEY['dr']; content = drag_l('中', '#e04747')
    elif kind == 'dg':
        key = KEY['dg']; content = drag_l('發', '#2fa55e')
    elif kind == 'back':
        content = back_l()
    else:
        rank, suit = kind[1], kind[0]
        if suit in 'dbc':
            rank = int(rank)
        key = KEY[suit]
        content = dots_l(rank) if suit == 'd' else bam_l(rank) if suit == 'b' else chars_l(rank) if suit == 'c' else wind_l(rank)
    op = ' opacity="0.8"' if dim else ''
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.4f})"{op}>' + shell_l(key) + content + '</g>'


def minitile(kind, x, y, w):
    return tile(kind, x, y, w)


# ---------- shared chrome ----------

def chipbox(x, y, w, h, text, fs=13):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>'
            f'<text x="{x+w/2}" y="{y+h/2+fs*0.35:.1f}" font-size="{fs}" font-weight="700" fill="{INK}" text-anchor="middle">{text}</text>')


def btn(x, y, w, h, text, primary, fs=17):
    face = 'url(#pa)' if primary else 'rgba(255,255,255,0.95)'
    sh = 'bs' if primary else 'bs2'
    colr = '#ffffff' if primary else INK
    stroke = ' stroke="#f3dfc9" stroke-width="1.5"' if not primary else ''
    return (f'<rect x="{x}" y="{y+4}" width="{w}" height="{h}" rx="{h/2}" fill="{"#e14b7c" if primary else "#eed9e2"}"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{face}"{stroke} filter="url(#{sh})"/>'
            f'<text x="{x+w/2}" y="{y+h/2+fs*0.35:.1f}" font-size="{fs}" font-weight="700" fill="{colr}" text-anchor="middle">{text}</text>')


# ---------- game-screen architecture (shared by overlays) ----------

HOLES = {(0, 3), (1, 6), (2, 0), (3, 3), (4, 5), (5, 1)}
BY = 170


def board_body():
    k = 0
    parts = []
    for row in range(6):
        for c in range(8):
            if (row, c) in HOLES:
                continue
            parts.append(tile(SEQ[k % len(SEQ)], 7 + c * 47, BY + row * 58, 44, dim=(2 <= row <= 3 and 2 <= c <= 5)))
            k += 1
    k += 1  # (cap continues the sequence)
    for r in (2, 3):
        for c in (2, 3, 4, 5):
            parts.append(tile(SEQ[k % len(SEQ)], 7 + c * 47, BY + r * 58 - 6, 44))
            k += 1
    px, py = 7 + 4 * 47, BY + 3 * 58 - 16
    parts.append(tile('d2', px, py, 44))
    parts.append(f'<rect x="{px-5}" y="{py-5}" width="54" height="65" rx="20" fill="none" stroke="{ACCENT}" stroke-width="2.5" stroke-dasharray="6 5"/>')
    return ''.join(parts)


def bank_body():
    parts = ['<text x="18" y="90" font-size="11" font-weight="700" fill="#9b7488">BANK</text>']
    slots = ['dr', 'b3', None, None]
    for i in range(4):
        x = 18 + i * 52
        if slots[i]:
            parts.append(f'<rect x="{x}" y="98" width="46" height="58" rx="12" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>')
            parts.append(minitile(slots[i], x + 1, y=99, w=44))
        else:
            parts.append(f'<rect x="{x}" y="98" width="46" height="58" rx="12" fill="#ffffff" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.95" stroke-width="2.5" stroke-dasharray="6 5"/>')
    return ''.join(parts)


def hud_body(chip='Melon · L12', score='12,850'):
    p = [f'<circle cx="36" cy="40" r="20" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>',
         '<text x="36" y="47" font-size="17" font-weight="800" fill="{}" text-anchor="middle">⏸</text>'.format(INK),
         chipbox(64, 24, 108, 32, chip),
         chipbox(180, 24, 70, 32, '⭐ ×2', 13),
         f'<text x="374" y="47" font-size="21" font-weight="800" fill="{INK}" text-anchor="end">12,850</text>' if score is None else
         f'<text x="374" y="47" font-size="21" font-weight="800" fill="{INK}" text-anchor="end">{score}</text>']
    return ''.join(p)


def boost_body():
    names = ['↩ Undo', '🔄 Shuffle', '💡 Hint']
    p = []
    for i, n in enumerate(names):
        x = 27 + i * 116
        p.append(f'<rect x="{x}" y="764" width="104" height="58" rx="16" fill="#ffffff" fill-opacity="0.95" filter="url(#bs2)"/>')
        p.append(f'<text x="{x+52}" y="798" font-size="15" font-weight="800" fill="{INK}" text-anchor="middle">{n}</text>')
    return ''.join(p)


def game_body(chip='Melon · L12', score='12,850', tooltip=False):
    p = [sky(), hud_body(chip, score), bank_body(), board_body(), boost_body()]
    if tooltip:
        p.append(f'<g filter="url(#cs)"><rect x="40" y="104" width="286" height="58" rx="14" fill="#fffdf7"/>'
                 f'<path d="M 150 162 L 162 162 L 156 176 Z" fill="#fffdf7"/></g>'
                 f'<text x="183" y="129" font-size="13" font-weight="700" fill="{INK}" text-anchor="middle">Tap a free tile to bank it —</text>'
                 f'<text x="183" y="149" font-size="13" font-weight="700" fill="{INK}" text-anchor="middle">two matching twins in the bank pop! 🍬</text>')
    return ''.join(p)


def scrim(card_x, card_y, card_w, card_h, inner):
    return (f'<rect width="390" height="844" fill="#4a2b3a" opacity="0.55"/>'
            + ''.join(inner)
            + f'<rect x="{card_x}" y="{card_y}" width="{card_w}" height="{card_h}" rx="24" fill="#fffdf7" filter="url(#cs)"/>' + extra_scan())


def extra_scan():
    return ''


def overlay_card(title, sub, buttons, stars=None, body=None, card_h=330):
    cx, cy, cw = 55, 236, 280
    inner = []
    yy = cy + 34
    inner.append(f'<text x="195" y="{yy}" font-size="21" font-weight="800" fill="{INK}" text-anchor="middle">{title}</text>')
    inner.append(f'<text x="195" y="{yy+22}" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">{sub}</text>')
    yy += 44
    if stars is not None:
        for i in range(3):
            filled = i < stars
            s = (f'<text x="{195-52+i*52}" y="{yy+34}" text-anchor="middle" font-size="40" fill="#ffb830">★</text>'
                 if filled else
                 f'<text x="{195-52+i*52}" y="{yy+34}" text-anchor="middle" font-size="40" fill="#d9c7c0" opacity="0.55" filter="url(#desat)">★</text>')
            inner.append(s)
        yy += 42
    if body:
        inner.append(body(195, yy))
        yy += 78
    for t, prim in buttons:
        inner.append(btn(cx + 20, yy, cw - 40, 54, t, prim, 16))
        yy += 62
    card = f'<rect x="{cx}" y="{cy}" width="{cw}" height="{yy - cy - 6}" rx="24" fill="#fffdf7" filter="url(#cs)"/>'
    return card + ''.join(inner)


def svg_doc(name, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" font-family="Segoe UI, sans-serif">'
            + DEFS + body + f'<title>{name}</title></svg>')


OUT = {}
OUT['game'] = svg_doc('Game', game_body())
OUT['game-tooltip'] = svg_doc('Game — first-run tooltip', game_body('Melon · L1', '0', tooltip=True))


def win_card():
    cx, cy, cw = 55, 216, 280
    inner = [f'<text x="195" y="{cy+36}" font-size="22" font-weight="800" fill="{INK}" text-anchor="middle">Level Clear! 🎉</text>',
             f'<text x="195" y="{cy+58}" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">Melon · Level 12</text>']
    for i in range(3):
        if i < 2:
            inner.append(f'<text x="{143+i*52}" y="{cy+106}" text-anchor="middle" font-size="40" fill="#ffb830">★</text>')
        else:
            inner.append(f'<text x="{143+i*52}" y="{cy+106}" text-anchor="middle" font-size="40" fill="#d9c7c0" opacity="0.6">★</text>')
    inner.append(f'<text x="195" y="{cy+150}" font-size="27" font-weight="900" fill="{ACCENT}" text-anchor="middle">12,850</text>')
    inner.append(f'<text x="195" y="{cy+172}" font-size="12" font-weight="700" fill="#59c96f" text-anchor="middle">🎉 New best score!</text>')
    for i, (t, prim) in enumerate([('▶ Next Level', True), ('↻ Replay', False), ('🗺 Levels', False)]):
        inner.append(btn(cx + 20, cy + 188 + i * 62, 240, 54, t, prim, 16))
    return f'<rect x="{cx}" y="{cy}" width="{cw}" height="{188 + 3*62 - 6}" rx="24" fill="#fffdf7" filter="url(#cs)"/>' + ''.join(inner)


OUT['win'] = svg_doc('Win overlay', game_body() + '<rect width="390" height="844" fill="#4a2b3a" opacity="0.55"/>' + win_card())

fail_tiles = ['d3', 'b2', 'wE', 'c7']


def fail_tiles_row(xc):
    xs = xc - 2 * 48 + 4
    return ''.join(minitile(k, xs + i * 48, 0, 38) for i, k in enumerate(fail_tiles))


def fail_card():
    cx, cy, cw = 55, 246, 280
    inner = [f'<text x="195" y="{cy+36}" font-size="21" font-weight="800" fill="{INK}" text-anchor="middle">The tin overflowed! 🍬</text>',
             f'<text x="195" y="{cy+58}" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">Four different candies, no pair — attempt ends.</text>']
    for i, k in enumerate(fail_tiles):
        inner.append(minitile(k, 195 - 94 + i * 49, cy + 80, 40))
    for i, (t, prim) in enumerate([('↻ Restart — fresh deal', True), ('🗺 Levels', False)]):
        inner.append(btn(cx + 20, cy + 132 + i * 62, 240, 54, t, prim, 15))
    return f'<rect x="{cx}" y="{cy}" width="{cw}" height="{132 + 2*62 - 8}" rx="24" fill="#fffdf7" filter="url(#cs)"/>' + ''.join(inner)


fail_body = game_body() + '<rect width="390" height="844" fill="#4a2b3a" opacity="0.55"/>' + fail_card()
OUT['fail'] = svg_doc('Fail overlay', fail_body)


def noprog_card():
    cx, cy, cw = 55, 216, 280
    inner = [f'<text x="195" y="{cy+36}" font-size="21" font-weight="800" fill="{INK}" text-anchor="middle">No moves in sight 🍬</text>',
             f'<text x="195" y="{cy+58}" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">Reshuffle the board, or take a step back?</text>']
    for i, (t, prim) in enumerate([('🔄 Shuffle', True), ('↩ Undo last bank', False), ('↻ Restart level', False), ('🗺 Levels', False)]):
        inner.append(btn(cx + 20, cy + 82 + i * 62, 240, 54, t, prim, 15))
    return f'<rect x="{cx}" y="{cy}" width="{cw}" height="{82 + 4*62 - 8}" rx="24" fill="#fffdf7" filter="url(#cs)"/>' + ''.join(inner)


OUT['no-progress'] = svg_doc('No-progress dialog', game_body() + '<rect width="390" height="844" fill="#4a2b3a" opacity="0.55"/>' + noprog_card())


def pause_card():
    cx, cy, cw = 55, 216, 280
    inner = [f'<text x="195" y="{cy+36}" font-size="21" font-weight="800" fill="{INK}" text-anchor="middle">Paused ⏸</text>',
             f'<text x="195" y="{cy+58}" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">Melon · Level 12</text>']
    for i, (t, prim) in enumerate([('▶ Resume', True), ('↻ Restart', False), ('⚙️ Settings', False), ('🗺 Levels', False)]):
        inner.append(btn(cx + 20, cy + 82 + i * 62, 240, 54, t, prim, 16))
    return f'<rect x="{cx}" y="{cy}" width="{cw}" height="{82 + 4*62 - 8}" rx="24" fill="#fffdf7" filter="url(#cs)"/>' + ''.join(inner)


OUT['pause'] = svg_doc('Pause panel', game_body() + '<rect width="390" height="844" fill="#4a2b3a" opacity="0.55"/>' + pause_card())


def home():
    p = [sky()]
    for i, (k, rot, dx, dy) in enumerate([('d2', -10, 96, 196), ('dr', 6, 168, 208), ('b1', -5, 238, 192)]):
        p.append(f'<g transform="rotate({rot} {dx+22} {dy+27})">' + tile(k, dx, dy, 44) + '</g>')
    p.append('<text x="195" y="316" font-size="52" font-weight="900" fill="#ffffff" stroke="#e14b7c" stroke-width="7" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">Mahjong</text>')
    p.append('<text x="195" y="374" font-size="52" font-weight="900" fill="#ffffff" stroke="#e14b7c" stroke-width="7" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">Lite</text>')
    p.append('<text x="195" y="408" font-size="15" font-weight="600" fill="#4a2b3a" opacity="0.7" text-anchor="middle">candy mahjong solitaire 🍬</text>')
    p.append(btn(35, 448, 320, 64, '▶ Play', True, 20))
    p.append(btn(35, 528, 320, 56, '🗺 Levels', False, 18))
    p.append(btn(35, 598, 320, 56, '📊 Stats', False, 18))
    p.append(btn(35, 668, 320, 56, '⚙️ Settings', False, 18))
    p.append(f'<text x="195" y="792" font-size="12" font-weight="600" fill="{INK}" opacity="0.55" text-anchor="middle">v1.0 · made with 🍬</text>')
    p.append(f'<text x="195" y="812" font-size="11" font-weight="600" fill="{INK}" opacity="0.45" text-anchor="middle">progress saved on this device · no ads, no tracking</text>')
    return ''.join(p)


OUT['home'] = svg_doc('Home', home())


def levels():
    p = [sky()]
    p.append(f'<circle cx="36" cy="40" r="20" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>')
    p.append(f'<text x="36" y="47" font-size="18" font-weight="800" fill="{INK}" text-anchor="middle">←</text>')
    p.append(f'<text x="66" y="48" font-size="26" font-weight="800" fill="{INK}">Levels</text>')
    p.append(chipbox(272, 24, 102, 32, '★ 24 / 180', 13))
    stars = [3, 3, 2, 1, 2, 3, 3]
    ly = 84

    def chapter(y, name, rng, col):
        p = [f'<circle cx="22" cy="{y-4}" r="6" fill="{col}"/>',
             f'<text x="36" y="{y}" font-size="15" font-weight="800" fill="{INK}">{name}</text>',
             f'<text x="118" y="{y}" font-size="11" font-weight="600" fill="{INK}" opacity="0.5">{rng}</text>']
        return ''.join(p)

    def grid(y, items):
        outp = []
        for i, (n, st, mode) in enumerate(items):
            x = 16 + (i % 4) * 92
            yy = y + (i // 4) * 78
            cur = mode == 'cur'
            lock = mode == 'lock'
            op = '0.55' if lock else '1'
            outp.append(f'<g opacity="{op}"><rect x="{x}" y="{yy+4}" width="80" height="66" rx="16" fill="#d9a9bb"/>'
                        f'<rect x="{x}" y="{yy}" width="80" height="66" rx="16" fill="#ffffff" fill-opacity="0.94" filter="url(#bs2)"/>')
            if cur:
                outp.append(f'<rect x="{x-3}" y="{yy-3}" width="86" height="72" rx="18" fill="none" stroke="{ACCENT}" stroke-width="3" stroke-dasharray="7 5"/>')
            if lock:
                outp.append(f'<text x="{x+40}" y="{yy+40}" font-size="20" text-anchor="middle">🔒</text>')
            else:
                outp.append(f'<text x="{x+40}" y="{yy+32}" font-size="20" font-weight="800" fill="{INK}" text-anchor="middle">{n}</text>')
                for j in range(3):
                    on = j < st
                    outp.append(f'<text x="{x+40-16+j*16:.0f}" y="{yy+52}" font-size="11" fill="{"#ffb830" if on else "#d9c7c0"}" opacity="{1 if on else 0.35}" text-anchor="middle">★</text>')
            outp.append('</g>')
        return ''.join(outp)

    p.append(f'<text x="22" y="{ly}" font-size="15" font-weight="800" fill="{INK}">●</text>')
    p.append(chapter(ly + 6, 'Melon', 'levels 1–12', ACCENT))
    items = [(i + 1, (stars[i] if i < len(stars) else 0), 'cur' if i == 7 else ('nor' if i < 7 else 'lock')) for i in range(8)]
    p.append(grid(ly + 18, items))
    byy = ly + 18 + 2 * 78
    p.append(chapter(byy + 6, 'Blueberry', 'levels 13–24', '#7a5cff'))
    berry = [(13, 0, 'nor'), (14, 0, 'nor'), (15, 0, 'lock'), (16, 0, 'lock')]
    berry = [(13, 0, 'cur'), (14, 0, 'lock'), (15, 0, 'lock'), (16, 0, 'lock')]
    p.append(grid(byy + 18, berry))
    p.append(f'<text x="195" y="{byy+18+156+40}" font-size="12" font-weight="600" fill="{INK}" opacity="0.5" text-anchor="middle">beating level N unlocks N+1 · replay anytime for stars</text>')
    return ''.join(p)


OUT['levels'] = svg_doc('Level select', levels())


def toggle(x, y, on, inert=False):
    track = '#6fce8d' if on and not inert else ('#e3d3c6' if not inert else '#d9cbc0')
    kx = x + 46 - 13.5 if (on and not inert) else x + 13.5
    extra = ' opacity="0.65"' if inert else ''
    return (f'<rect x="{x}" y="{y}" width="46" height="27" rx="13.5" fill="{track}"{extra}/>'
            f'<circle cx="{kx}" cy="{y + 13.5}" r="11" fill="#ffffff" opacity="{0.9 if inert else 1}"/>')


def stats():
    p = [sky()]
    p.append('<circle cx="36" cy="40" r="20" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>')
    p.append('<text x="36" y="47" font-size="18" font-weight="800" fill="{}" text-anchor="middle">←</text>'.format(INK))
    p.append(f'<text x="66" y="48" font-size="26" font-weight="800" fill="{INK}">Stats</text>')
    data = [('741', '🫧 pairs cleared'), ('57', '🎮 games played'), ('×9', '🔥 best combo'),
            ('12', '🏁 levels completed'), ('2', '🧺 tin overflows'), ('24 / 180', '⭐ total stars')]
    for i, (v, l) in enumerate(data):
        x = 16 + (i % 2) * 180
        y = 92 + (i // 2) * 96
        p.append(f'<rect x="{x}" y="{y+4}" width="170" height="84" rx="16" fill="#d9a9bb"/>')
        p.append(f'<rect x="{x}" y="{y}" width="170" height="84" rx="16" fill="#ffffff" fill-opacity="0.94" filter="url(#bs2)"/>')
        p.append(f'<text x="{x+16}" y="{y+44}" font-size="24" font-weight="800" fill="{INK}">{v}</text>')
        p.append(f'<text x="{x+16}" y="{y+66}" font-size="12" font-weight="600" fill="{INK}" opacity="0.6">{l}</text>')
    p.append(f'<text x="195" y="420" font-size="12" font-weight="600" fill="{INK}" opacity="0.5" text-anchor="middle">lifetime, per device — reset only in Settings</text>')
    return ''.join(p)


OUT['stats'] = svg_doc('Stats', stats())


def settings():
    p = [sky()]
    p.append('<circle cx="36" cy="40" r="20" fill="#ffffff" fill-opacity="0.92" filter="url(#bs2)"/>')
    p.append('<text x="36" y="47" font-size="18" font-weight="800" fill="{}" text-anchor="middle">←</text>'.format(INK))
    p.append(f'<text x="66" y="48" font-size="26" font-weight="800" fill="{INK}">Settings</text>')

    def group(y, h):
        return (f'<rect x="16" y="{y+4}" width="358" height="{h}" rx="18" fill="#d9a9bb"/>'
                f'<rect x="16" y="{y}" width="358" height="{h}" rx="18" fill="#ffffff" fill-opacity="0.94" filter="url(#bs2)"/>')

    def row(y, icon, label, control, dim=False):
        op = ' opacity="0.5"' if dim else ''
        return (f'<g{op}><text x="34" y="{y+27}" font-size="15" font-weight="600" fill="{INK}">{icon} {label}</text>'
                f'{control}</g>')

    p.append(group(88, 108))
    p.append(row(96, '🔊', 'Sound effects', toggle(312, 100, True)))
    p.append(f'<line x1="32" y1="142" x2="358" y2="142" stroke="#f2e6cf" stroke-width="1.5"/>')
    p.append(row(146, '🎵', 'Music', toggle(312, 150, False, inert=True)))
    p.append('<text x="290" y="163" font-size="10" font-weight="800" fill="#ffffff">soon</text>')
    p.append('<text x="200" y="215" font-size="11" font-weight="600" fill="#9b7488" text-anchor="middle">music ships post-launch · toggle stays resident (§12.2)</text>')

    p.append(group(232, 108))
    p.append(row(240, '✨', 'Highlight free tiles', toggle(312, 244, True)))
    p.append(f'<line x1="32" y1="286" x2="358" y2="286" stroke="#f2e6cf" stroke-width="1.5"/>')
    p.append(row(290, '🧘', 'Reduce motion', toggle(312, 294, False)))

    p.append(group(364, 56))
    p.append(f'<text x="34" y="398" font-size="15" font-weight="600" fill="#e05a5a">🗑 Reset progress</text>')
    p.append('<text x="340" y="398" font-size="11" font-weight="700" fill="#9b7488" text-anchor="end">double-confirm</text>')

    p.append('<text x="34" y="446" font-size="11" font-weight="600" fill="#9b7488">Mahjong Lite v1.0 · no ads · no accounts · no tracking</text>')
    p.append('<text x="34" y="464" font-size="11" font-weight="600" fill="#9b7488">progress saved locally in this browser only 🍪</text>')
    return ''.join(p)


OUT['settings'] = svg_doc('Settings', settings())

# ---------- write files ----------
from pathlib import Path
OUTDIR = str(Path(__file__).resolve().parents[1] / 'screens')
os.makedirs(OUTDIR, exist_ok=True)
for name, content in OUT.items():
    with open(os.path.join(OUTDIR, name + '.svg'), 'w', encoding='utf-8') as f:
        f.write(content)
print('wrote', len(OUT), 'screens:', ', '.join(sorted(OUT)))

# ---------- contact sheet ----------
order = [('home', 'Home'), ('levels', 'Level select'), ('game', 'Game'), ('game-tooltip', 'First-run tooltip'), ('stats', 'Stats'),
         ('settings', 'Settings'), ('win', 'Win overlay'), ('fail', 'Fail overlay'), ('no-progress', 'No-progress dialog'), ('pause', 'Pause panel')]
TH_W, TH_H = 176, 381
sheet = ['<svg xmlns="http://www.w3.org/2000/svg" width="984" height="940" viewBox="0 0 984 940" font-family="Segoe UI, sans-serif">',
         '<defs><linearGradient id="bgg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3ef"/><stop offset="1" stop-color="#ffbcd2"/></linearGradient></defs>',
         '<rect width="984" height="940" fill="url(#bgg2)"/>',
         '<text x="40" y="40" font-size="22" font-weight="800" fill="#4a2b3a">Mahjong Lite — screen mockups (§9.3 / §9.4, 390×844 stage)</text>']
for i, (name, label) in enumerate(order):
    x = 40 + (i % 5) * (TH_W + 14)
    y = 64 + (i // 5) * (TH_H + 56)
    sheet.append(f'<image href="{name}.svg" x="{x}" y="{y}" width="{TH_W}" height="{TH_H}"/>')
    sheet.append(f'<rect x="{x-2}" y="{y-2}" width="{TH_W+4}" height="{TH_H+4}" rx="12" fill="none" stroke="#ffffff" stroke-width="4"/>')
    sheet.append(f'<text x="{x+TH_W/2:.0f}" y="{y+TH_H+26}" font-size="13" font-weight="700" fill="#4a2b3a" text-anchor="middle">{label}</text>')
sheet.append('</svg>')
with open(os.path.join(OUTDIR, 'all.svg'), 'w', encoding='utf-8') as f:
    f.write(''.join(sheet))
print('wrote contact sheet all.svg')
