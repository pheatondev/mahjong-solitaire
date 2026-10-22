# Generates design/tile-face-specimen.svg per GDD §10.3/§11
import os
W, H, R = 112, 140, 26
SX, X0 = 128, 40
ROW0, ROWSTRIDE = 112, 220

def col(c):
    return X0 + c * SX

def rowy(r):
    return ROW0 + r * ROWSTRIDE

def shell(x, y, key):
    p = []
    p.append(f'<rect x="{x}" y="{y+6}" width="{W}" height="{H}" rx="{R}" fill="#d9c2a4"/>')
    p.append(f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="{R}" fill="url(#ivory)" stroke="#e6d2b6" stroke-width="1.5"/>')
    p.append(f'<rect x="{x+4}" y="{y+4}" width="{W-8}" height="{H-8}" rx="{R-4}" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2"/>')
    if key:
        p.append(f'<rect x="{x+14}" y="{y+H-21}" width="{W-28}" height="5" rx="2.5" fill="{key}"/>')
    return ''.join(p)

# [((dx,dy),radius), ...] relative to face center (cx, y+66)
DOT = {
    1: [((0, 0), 15)],
    2: [((0, -20), 11), ((0, 20), 11)],
    3: [((-22, -20), 11), ((0, 0), 11), ((22, 20), 11)],
    4: [((-24, -19), 11), ((24, -19), 11), ((-24, 19), 11), ((24, 19), 11)],
    5: [((-24, -19), 11), ((24, -19), 11), ((0, 0), 11), ((-24, 19), 11), ((24, 19), 11)],
    6: [((-22, -23), 10), ((22, -23), 10), ((-22, 0), 10), ((22, 0), 10), ((-22, 23), 10), ((22, 23), 10)],
    7: [((-30, -26), 10), ((0, -26), 10), ((30, -26), 10), ((-16, 9), 10), ((16, 9), 10), ((-16, 35), 10), ((16, 35), 10)],
    8: [((-22, -27), 9), ((22, -27), 9), ((-22, -9), 9), ((22, -9), 9), ((-22, 9), 9), ((22, 9), 9), ((-22, 27), 9), ((22, 27), 9)],
    9: [((dx, dy), 9) for dx in (-30, 0, 30) for dy in (-27, 0, 27)],
}

def dots(g, x, y, rank):
    cx, cy = x + W / 2, y + 66
    for (dx, dy), r in DOT[rank]:
        g.append(f'<circle cx="{cx+dx}" cy="{cy+dy}" r="{r}" fill="url(#dotg)"/>')
        g.append(f'<circle cx="{cx+dx-r*0.28:.1f}" cy="{cy+dy-r*0.34:.1f}" r="{r*0.30:.1f}" fill="#ffffff" opacity="0.75"/>')

def stick(g, x, y, dx, dy):
    cx, cy = x + W / 2 + dx, y + 66 + dy
    g.append(f'<rect x="{cx-4.5:.1f}" y="{cy-12}" width="9" height="24" rx="4.5" fill="url(#bamg)"/>')
    g.append(f'<line x1="{cx-4.5:.1f}" x2="{cx+4.5:.1f}" y1="{cy-4}" y2="{cy-4}" stroke="#2f9e57" stroke-width="1.6"/>')
    g.append(f'<line x1="{cx-4.5:.1f}" x2="{cx+4.5:.1f}" y1="{cy+4}" y2="{cy+4}" stroke="#2f9e57" stroke-width="1.6"/>')

def bamboos(g, x, y, rank):
    if rank == 1:
        g.append(f'<text x="{x+W/2}" y="{y+80}" font-family="Segoe UI Emoji, sans-serif" font-size="46" text-anchor="middle">🐦</text>')
        return
    for (dx, dy), _r in DOT[rank]:
        stick(g, x, y, dx, dy)

NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

def chars(g, x, y, rank):
    g.append(f'<text x="{x+W/2}" y="{y+56}" font-family="Segoe UI, sans-serif" font-size="36" font-weight="700" fill="#c23a4d" text-anchor="middle">{NUM[rank-1]}</text>')
    g.append(f'<text x="{x+W/2}" y="{y+102}" font-family="Segoe UI, sans-serif" font-size="30" font-weight="700" fill="#c23a4d" text-anchor="middle">萬</text>')

def wind(g, x, y, letter, needle_rot):
    cx = x + W / 2
    g.append(f'<text x="{cx}" y="{y+64}" font-family="Segoe UI, sans-serif" font-size="42" font-weight="800" fill="#5a43a8" text-anchor="middle">{letter}</text>')
    g.append(f'<g transform="rotate({needle_rot} {cx} {y+94})">'
             f'<path d="M {cx} {y+82} L {cx+5} {y+94} L {cx-5} {y+94} Z" fill="#e05a5a"/>'
             f'<path d="M {cx} {y+106} L {cx+5} {y+94} L {cx-5} {y+94} Z" fill="#ffffff" stroke="#b9a3b6" stroke-width="1"/>'
             f'<circle cx="{cx}" cy="{y+94}" r="2.4" fill="#5a43a8"/></g>')

def dragon(x, y, char, ink):
    g = []
    g.append(f'<rect x="{x+10}" y="{y+10}" width="{W-20}" height="{H-20}" rx="16" fill="none" stroke="{ink}" stroke-width="2.5" stroke-opacity="0.85"/>')
    g.append(f'<text x="{x+W/2}" y="{y+88}" font-family="Segoe UI, sans-serif" font-size="52" font-weight="800" fill="{ink}" text-anchor="middle">{char}</text>')
    return ''.join(g)

def back(x, y):
    p = [f'<rect x="{x}" y="{y+6}" width="{W}" height="{H}" rx="{R}" fill="#d9c2a4"/>',
         f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="{R}" fill="#fff1f6" stroke="#e6d2b6" stroke-width="1.5"/>',
         f'<g clip-path="url(#faceclip)"><g transform="rotate(-16 {x+W/2} {y+H/2})">']
    fills = ['#ffdce9', '#ffc3d8']
    for i in range(-3, 7):
        sx = x - 40 + i * 30
        p.append(f'<rect x="{sx}" y="{y-60}" width="14" height="{H+120}" fill="{fills[i % 2]}"/>')
    p.append('</g></g>')
    p.append(f'<rect x="{x+4}" y="{y+4}" width="{W-8}" height="{H-8}" rx="{R-4}" fill="none" stroke="#e6007e" stroke-opacity="0.14" stroke-width="2"/>')
    p.append(f'<text x="{x+W-22}" y="{y+H-18}" font-family="Segoe UI Emoji, sans-serif" font-size="17" fill="#ff5d8f">✦</text>')
    return ''.join(p)

def label(x, y, text):
    return f'<text x="{x+W/2}" y="{y+H+20}" font-family="Segoe UI, sans-serif" font-size="12" font-weight="600" fill="#9b7488" text-anchor="middle">{text}</text>'

def head(y, text):
    return f'<text x="{X0}" y="{y}" font-family="Segoe UI, sans-serif" font-size="15" font-weight="800" fill="#4a2b3a">{text}</text>'

out = []
out.append('<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1230" viewBox="0 0 1240 1230" font-family="Segoe UI, sans-serif">')
out.append('''<defs>
<linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f8efdd"/></linearGradient>
<radialGradient id="dotg" cx="0.35" cy="0.3" r="1"><stop offset="0" stop-color="#9ed6ff"/><stop offset="0.55" stop-color="#3f9bea"/><stop offset="1" stop-color="#1f74c0"/></radialGradient>
<linearGradient id="bamg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3a0"/><stop offset="1" stop-color="#2fa55e"/></linearGradient>
<linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3ef"/><stop offset="1" stop-color="#ffbcd2"/></linearGradient>
<clipPath id="faceclip"><rect x="4" y="4" width="104" height="132" rx="22"/></clipPath>
</defs>''')
out.append('<rect width="1240" height="1230" fill="url(#bgg)"/>')
out.append('<text x="40" y="46" font-size="27" font-weight="800" fill="#4a2b3a">Mahjong Lite — tile face specimen</text>')
out.append('<text x="40" y="72" font-size="13" font-weight="600" fill="#8a5f70">GDD §11 · tile anatomy: ivory face #fffdf7 · 22% radius · 2 px white rim · extruded edge · family keyline under the face · production faces ship as inline SVG symbols, emoji only for decor</text>')

# Row 1 — dots
y = ROW0
out.append(head(y + 4, 'Dots (筒) 1–9 · keyline blue #4aa3ff · rank-4 = clover'))
yy = y + 14
for r in range(1, 10):
    x = col(r - 1)
    out.append(shell(x, yy, '#4aa3ff'))
    g = []
    dots(g, x, yy, r)
    out.extend(g)
    out.append(label(x, yy, str(r)))

# Row 2 — bamboo
y = rowy(1)
out.append(head(y + 4, 'Bamboo (索) 1–9 · keyline green #3ec46d · rank-1 = bird 🐦'))
yy = y + 14
for r in range(1, 10):
    x = col(r - 1)
    out.append(shell(x, yy, '#3ec46d'))
    g = []
    bamboos(g, x, yy, r)
    out.extend(g)
    out.append(label(x, yy, str(r)))

# Row 3 — characters
y = rowy(2)
out.append(head(y + 4, 'Characters (万) 1–9 · red glyph style · keyline red #ff4d4d'))
yy = y + 14
for r in range(1, 10):
    x = col(r - 1)
    out.append(shell(x, yy, '#ff4d4d'))
    g = []
    chars(g, x, yy, r)
    out.extend(g)
    out.append(label(x, yy, str(r)))

# Row 4 — winds + dragons + back
y = rowy(3)
out.append(head(y + 4, 'Winds (風) — letter + compass needle · keyline indigo #7a5cff · Dragons (三元) · tile back (§10.3)'))
yy = y + 14
winds = [('E', 'East', 0), ('S', 'South', 90), ('W', 'West', 180), ('N', 'North', 270)]
for i, (letter, name, rot) in enumerate(winds):
    x = col(i)
    out.append(shell(x, yy, '#7a5cff'))
    g = []
    wind(g, x, yy, letter, rot)
    out.extend(g)
    out.append(label(x, yy, name))
dr = [('中', '#e04747', 'Red'), ('發', '#2fa55e', 'Green')]
for i, (ch, ink, name) in enumerate(dr):
    x = col(4 + i)
    out.append(shell(x, yy, ink))
    out.append(dragon(x, yy, ch, ink))
    out.append(label(x, yy, name))
x = col(6)
out.append(shell(x, yy, '#a5defd'))  # wait — white dragon instead
out[-1] = shell(x, yy, '#8fd7ff')
wt = [f'<rect x="{x+12}" y="{yy+12}" width="{W-24}" height="{H-24}" rx="14" fill="none" stroke="#8fd7ff" stroke-width="4"/>',
      f'<rect x="{x+20}" y="{yy+20}" width="{W-40}" height="{H-40}" rx="10" fill="none" stroke="#8fd7ff" stroke-width="1.5" stroke-opacity="0.6"/>']
out.extend(wt)
out.append(label(x, yy, 'White (frame)'))
x = col(7)
out.append(back(x, yy))
out.append(label(x, yy, 'Face-down back'))

# Row 5 — decor families (not dealt in v1)
y = rowy(4)
out.append(head(y + 4, 'Flowers & Seasons (decor) — emoji glyphs · NOT dealt in v1 (locked §8.1) — symbols ship for backlog variants'))
yy = y + 14
fl = ['🌸', '🌺', '🌷', '🌻']
for i, e in enumerate(fl):
    x = col(i)
    out.append(shell(x, yy, '#ff5d8f'))
    out.append(f'<text x="{x+W/2}" y="{yy+80}" font-family="Segoe UI Emoji, sans-serif" font-size="46" text-anchor="middle">{e}</text>')
se = ['🌱', '☀️', '🍂', '❄️']
for i, e in enumerate(se):
    x = col(4 + i)
    out.append(shell(x, yy, '#ffb830'))
    out.append(f'<text x="{x+W/2}" y="{yy+80}" font-family="Segoe UI Emoji, sans-serif" font-size="46" text-anchor="middle">{e}</text>')
out.append(label(col(2), yy, 'flower pairs'))
out.append(label(col(5), yy, 'season pairs'))

out.append('<text x="40" y="1194" font-size="13" font-weight="600" fill="#8a5f70">Mahjong Lite · face specimen · matching = exact rank + face (§3.2) · every family must appear an even number of times · flowers/seasons reserved for backlog (§19)</text>')
out.append('</svg>')

os.makedirs(r'C:\R\OpenCode Projects\MahjongLite\design', exist_ok=True)
path = r'C:\R\OpenCode Projects\MahjongLite\design\tile-face-specimen.svg'
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('written', path)
