#!/usr/bin/env python3
"""
Convierte los documentos Markdown de docs/ a PDF con la identidad de Neurofic.

Markdown -> HTML (python-markdown) -> PDF (Chromium headless).
Se eligió Chromium porque ya está en el entorno para las pruebas y produce
texto seleccionable, tabla de contenidos navegable y numeración de páginas,
sin arrastrar una instalación de LaTeX.

    python3 scripts/md-a-pdf.py --manual breve      # manual de usuario
    python3 scripts/md-a-pdf.py --manual completo   # manual extenso
    python3 scripts/md-a-pdf.py docs/DEPLOY.md      # cualquier .md suelto
    python3 scripts/md-a-pdf.py --todos             # todos los de docs/

Los manuales NO se editan como documento: se arman a partir de los artículos de
ayuda de `frontend/src/help/content/`, que son la única fuente. Así la app y el
PDF no pueden contradecirse.

Los PDF se dejan en docs/pdf/ (ignorada por git: se regeneran cuando hagan falta).

Requiere `pip install markdown` y las dependencias de frontend/ instaladas
(Playwright es un paquete de Node en este proyecto, por eso el renderizado se
delega a un script temporal ejecutado con node).
"""

import html
import json
import os
import subprocess
import tempfile
import re
import sys
from datetime import datetime
from pathlib import Path

import markdown

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / 'docs'
SALIDA = DOCS / 'pdf'
LOGO = RAIZ / 'frontend' / 'src' / 'assets' / 'neurofic-logo.svg'
AYUDA = RAIZ / 'frontend' / 'src' / 'help' / 'content'

# Mismos colores que brand.ts y el comprobante de honorarios del backend.
AZUL = '#1e40af'
TINTA = '#0f172a'
GRIS = '#64748b'
BORDE = '#e2e8f0'
CLARO = '#f1f5f9'

MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

CSS = f"""
@page {{
  size: Letter;
  margin: 20mm 18mm 22mm 18mm;
}}
* {{ box-sizing: border-box; }}
body {{
  font-family: Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: {TINTA};
  margin: 0;
}}

/* ── Portada ───────────────────────────────────────────────────────────── */
.portada {{
  height: 235mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}}
.portada__logo {{ width: 105px; margin: 0 auto 26px; }}
.portada__marca {{
  font-size: 30pt; font-weight: 700; letter-spacing: 2px;
  color: {AZUL}; margin: 0;
}}
.portada__desc {{ font-size: 11pt; color: {GRIS}; margin: 4px 0 40px; }}
.portada__titulo {{
  font-size: 22pt; font-weight: 700; margin: 0 0 10px; color: {TINTA};
}}
.portada__regla {{
  width: 90px; height: 3px; background: {AZUL};
  margin: 18px auto 22px; border: 0;
}}
.portada__meta {{ font-size: 10pt; color: {GRIS}; line-height: 1.9; }}

/* ── Índice ────────────────────────────────────────────────────────────── */
.toc {{ page-break-before: always; }}
.cuerpo {{ page-break-before: always; }}
.toc h2 {{
  font-size: 15pt; color: {AZUL}; border-bottom: 2px solid {BORDE};
  padding-bottom: 6px; margin-bottom: 14px;
}}
.toc ol {{ list-style: none; padding-left: 0; counter-reset: none; }}
.toc li {{ margin: 3px 0; }}
.toc li.n2 {{ font-size: 10.5pt; font-weight: 600; margin-top: 7px; }}
.toc li.n2 a {{ color: {TINTA}; }}
.toc li.n3 {{ padding-left: 20px; font-size: 9.5pt; }}
.toc li.n3 a {{ color: {GRIS}; }}
.toc a {{ text-decoration: none; }}

/* ── Cuerpo ────────────────────────────────────────────────────────────── */
h1, h2, h3, h4 {{ page-break-after: avoid; }}
h1 {{
  font-size: 18pt; color: {AZUL}; margin: 0 0 14px;
  padding-bottom: 8px; border-bottom: 2px solid {BORDE};
}}
h2 {{
  font-size: 14pt; color: {AZUL}; margin: 26px 0 10px;
  padding-bottom: 5px; border-bottom: 1px solid {BORDE};
  page-break-before: auto;
}}
h3 {{ font-size: 11.5pt; color: {TINTA}; margin: 18px 0 7px; }}
h4 {{ font-size: 10.5pt; color: {GRIS}; margin: 14px 0 5px;
      text-transform: uppercase; letter-spacing: .04em; }}
p {{ margin: 0 0 9px; orphans: 3; widows: 3; }}
ul, ol {{ margin: 0 0 10px; padding-left: 20px; }}
li {{ margin: 3px 0; }}
strong {{ color: {TINTA}; }}
hr {{ border: 0; border-top: 1px solid {BORDE}; margin: 20px 0; }}

table {{
  width: 100%; border-collapse: collapse; margin: 10px 0 16px;
  font-size: 9pt; page-break-inside: avoid;
}}
th {{
  background: {CLARO}; color: #475569; text-align: left;
  padding: 6px 8px; border: 1px solid {BORDE};
  font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em;
}}
td {{ padding: 6px 8px; border: 1px solid {BORDE}; vertical-align: top; }}
tr:nth-child(even) td {{ background: #fafafa; }}

code {{
  font-family: "DejaVu Sans Mono", Consolas, monospace;
  font-size: 8.8pt; background: {CLARO}; padding: 1px 4px;
  border-radius: 3px; color: #0f172a;
}}
pre {{
  background: {CLARO}; border: 1px solid {BORDE}; border-radius: 6px;
  padding: 10px 12px; overflow-x: auto; page-break-inside: avoid;
  font-size: 8.5pt; line-height: 1.45;
}}
pre code {{ background: none; padding: 0; }}

blockquote {{
  margin: 12px 0; padding: 9px 14px;
  background: #fffbeb; border-left: 3px solid #f59e0b;
  color: #78350f; page-break-inside: avoid;
}}
blockquote p {{ margin: 0 0 5px; }}
blockquote p:last-child {{ margin: 0; }}
"""


MANUALES = {
    'breve': ('Manual de Usuario', 'MANUAL_USUARIO'),
    'completo': ('Manual Completo', 'Manual_Neurofic_Dashboard'),
}

FRONTMATTER = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.S)
DETALLE = re.compile(r'<details>\s*\n<summary>(.*?)</summary>(.*?)</details>', re.S)


def leer_articulos() -> list[dict]:
    """Lee los artículos de ayuda con sus metadatos, ordenados."""
    arts = []
    for ruta in sorted(AYUDA.glob('*.md')):
        crudo = ruta.read_text(encoding='utf-8')
        m = FRONTMATTER.match(crudo)
        if not m:
            print(f'  aviso: {ruta.name} sin metadatos, se omite')
            continue
        meta = {}
        for linea in m.group(1).split('\n'):
            if ':' in linea:
                k, v = linea.split(':', 1)
                meta[k.strip()] = v.strip()
        arts.append({
            'titulo': meta.get('titulo', ruta.stem),
            'orden': int(meta.get('orden', 999)),
            'cuerpo': crudo[m.end():].strip(),
        })
    return sorted(arts, key=lambda a: a['orden'])


def resolver_detalles(md: str, expandir: bool) -> str:
    """Los bloques <details> son el nivel "a fondo": el manual breve los quita y
    el completo los despliega como una subsección normal."""
    def sustituir(m: re.Match) -> str:
        if not expandir:
            return ''
        titulo = m.group(1).strip()
        return f'\n\n### {titulo}\n{m.group(2).strip()}\n'
    return DETALLE.sub(sustituir, md)


def degradar_encabezados(md: str) -> str:
    """El título del artículo pasa a ser ##, así que sus ## internos bajan a ###."""
    return re.sub(r'^(#{2,4})(\s)', lambda m: '#' + m.group(1) + m.group(2), md, flags=re.M)


def componer_manual(modo: str) -> tuple[str, str]:
    """Devuelve (markdown, nombre de archivo) del manual pedido."""
    titulo, base = MANUALES[modo]
    arts = leer_articulos()

    partes = [f'# {titulo} — Neurofic Admin Dashboard', '']
    if modo == 'breve':
        partes += ['> Versión resumida. El manual completo incluye además el detalle',
                   '> ampliado de cada sección.', '']
    for a in arts:
        cuerpo = degradar_encabezados(resolver_detalles(a['cuerpo'], modo == 'completo'))
        partes += ['---', '', f"## {a['titulo']}", '', cuerpo, '']

    print(f'  {len(arts)} artículos compuestos')
    return '\n'.join(partes), base


def logo_data_uri() -> str:
    """El SVG se incrusta en base64: Chromium no puede leer file:// desde
    contenido servido con setContent."""
    import base64
    if not LOGO.exists():
        return ''
    b64 = base64.b64encode(LOGO.read_bytes()).decode()
    return f'data:image/svg+xml;base64,{b64}'


def construir_toc(cuerpo_html: str) -> tuple[str, str]:
    """Extrae los encabezados h2/h3, les pone ancla y arma el índice."""
    entradas = []
    contador = [0]

    def anclar(m: re.Match) -> str:
        nivel, atributos, texto = m.group(1), m.group(2), m.group(3)
        contador[0] += 1
        ancla = f'sec{contador[0]}'
        limpio = re.sub(r'<[^>]+>', '', texto).strip()
        entradas.append((nivel, ancla, limpio))
        return f'<h{nivel} id="{ancla}"{atributos}>{texto}</h{nivel}>'

    cuerpo = re.sub(r'<h([23])([^>]*)>(.*?)</h\1>', anclar, cuerpo_html, flags=re.S)

    filas = ''.join(
        f'<li class="n{n}"><a href="#{a}">{html.escape(t)}</a></li>'
        for n, a, t in entradas
    )
    toc = f'<div class="toc"><h2>Contenido</h2><ol>{filas}</ol></div>' if filas else ''
    return cuerpo, toc


def a_html(md_path: Path, version: str) -> str:
    texto = md_path.read_text(encoding='utf-8')

    # El primer encabezado del documento pasa a ser el título de la portada.
    m = re.search(r'^#\s+(.+)$', texto, re.M)
    titulo = m.group(1).strip() if m else md_path.stem
    if m:
        texto = texto[:m.start()] + texto[m.end():]

    cuerpo = markdown.markdown(
        texto,
        extensions=['tables', 'fenced_code', 'sane_lists', 'attr_list'],
    )
    cuerpo, toc = construir_toc(cuerpo)

    hoy = datetime.now()
    fecha = f'{hoy.day} de {MESES[hoy.month]} de {hoy.year}'
    logo = logo_data_uri()
    img = f'<img class="portada__logo" src="{logo}" alt="Neurofic">' if logo else ''

    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>{html.escape(titulo)}</title><style>{CSS}</style></head>
<body>
  <div class="portada">
    {img}
    <p class="portada__marca">NEUROFIC</p>
    <p class="portada__desc">Centro de Neurofisiología Clínica</p>
    <h1 class="portada__titulo" style="border:0;color:{TINTA}">{html.escape(titulo)}</h1>
    <hr class="portada__regla">
    <div class="portada__meta">
      Versión {version}<br>
      {fecha}<br>
      dashboard.neurofic.com
    </div>
  </div>
  {toc}
  <div class="cuerpo">{cuerpo}</div>
</body></html>"""


RENDER_JS = r"""
const { chromium } = require('playwright');
const trabajos = JSON.parse(process.argv[2]);
const pie = process.argv[3];
(async () => {
  const navegador = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const pagina = await navegador.newPage();
  for (const t of trabajos) {
    await pagina.goto('file://' + t.html, { waitUntil: 'load' });
    await pagina.emulateMedia({ media: 'print' });
    await pagina.pdf({
      path: t.pdf,
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: pie,
      margin: { top: '16mm', bottom: '18mm', left: '0', right: '0' },
    });
    console.log(t.pdf);
  }
  await navegador.close();
})();
"""


def render(pares, version: str) -> None:
    pie = (
        '<div style="width:100%;font-size:7.5pt;color:#64748b;'
        'font-family:Helvetica,Arial,sans-serif;padding:0 18mm;'
        'display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;'
        'padding-top:4px;">'
        f'<span>Neurofic - Manual - v{version}</span>'
        '<span>Página <span class="pageNumber"></span> de '
        '<span class="totalPages"></span></span>'
        '</div>'
    )

    tmp = tempfile.mkdtemp(prefix='md2pdf-')
    trabajos = []
    for origen, destino in pares:
        ruta_html = os.path.join(tmp, origen.stem + '.html')
        Path(ruta_html).write_text(a_html(origen, version), encoding='utf-8')
        trabajos.append({'html': ruta_html, 'pdf': destino})

    # El script va DENTRO de frontend/: node resuelve los módulos relativo al
    # archivo, no al directorio de trabajo, así que desde /tmp no encontraría
    # 'playwright'.
    script = RAIZ / 'frontend' / '.md2pdf-render.cjs'
    script.write_text(RENDER_JS, encoding='utf-8')
    try:
        r = subprocess.run(
            ['node', str(script), json.dumps(trabajos), pie],
            cwd=str(RAIZ / 'frontend'), capture_output=True, text=True,
        )
    finally:
        script.unlink(missing_ok=True)
    if r.returncode != 0:
        raise SystemExit('Fallo al renderizar:\n' + (r.stderr or r.stdout)[-1500:])

    for _, destino in pares:
        kb = Path(destino).stat().st_size / 1024
        print(f'  {Path(destino).name:52} {kb:7.0f} kB')


def main() -> int:
    version = json.loads((RAIZ / 'package.json').read_text())['version']

    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1

    if args[0] == '--manual':
        modo = args[1] if len(args) > 1 else 'breve'
        if modo not in MANUALES:
            print(f'Modo desconocido: {modo}. Usa "breve" o "completo".')
            return 1
        md, base = componer_manual(modo)
        SALIDA.mkdir(parents=True, exist_ok=True)
        # Se deja también el .md compuesto: útil para revisar el resultado y
        # para quien prefiera el texto plano.
        tmp_md = SALIDA / f'{base}.md'
        tmp_md.write_text(md, encoding='utf-8')
        print(f'Generando manual «{modo}» (versión {version}):')
        render([(tmp_md, str(SALIDA / f'{base}.pdf'))], version)
        print(f'\nEn {SALIDA.relative_to(RAIZ)}/')
        return 0

    if args == ['--todos']:
        objetivos = sorted(f for f in DOCS.glob('*.md') if f.name != 'README.md')
    else:
        objetivos = [Path(a) if Path(a).exists() else DOCS / a for a in args]

    faltan = [o for o in objetivos if not o.exists()]
    if faltan:
        print('No existe:', ', '.join(str(f) for f in faltan))
        return 1

    SALIDA.mkdir(parents=True, exist_ok=True)
    pares = [(o, str(SALIDA / f'{o.stem}.pdf')) for o in objetivos]

    print(f'Generando {len(pares)} PDF (versión {version}):')
    render(pares, version)
    print(f'\nEn {SALIDA.relative_to(RAIZ)}/')
    return 0


if __name__ == '__main__':
    sys.exit(main())
