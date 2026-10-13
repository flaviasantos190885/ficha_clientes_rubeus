"""Gera para-colar/favorito-conferir-gestao.txt (o endereço "javascript:..." do favorito) e
para-colar/favorito-conferir-gestao.html (página com o botão para arrastar até a barra de favoritos),
a partir de favorito/conferir-gestao.js. Não usa token.

Uso:
  python3 -I ferramentas/gerar-favorito.py
"""
from pathlib import Path
from urllib.parse import quote

RAIZ = Path(__file__).resolve().parent.parent


def main():
    js = (RAIZ / "favorito" / "conferir-gestao.js").read_text(encoding="utf-8")
    url = "javascript:" + quote(js, safe="()*'!~")
    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (RAIZ / "favorito" / "favorito.txt").write_text(url, encoding="utf-8")
    (saida / "favorito-conferir-gestao.txt").write_text(url, encoding="utf-8")
    html = (
        '<!doctype html><meta charset="utf-8"><title>Favorito</title>'
        '<p style="font:16px Arial">Arraste este botão para a barra de favoritos:</p>'
        f'<p><a href="{url}" style="padding:10px 16px;background:#0e8f7e;color:#fff;border-radius:6px;'
        'text-decoration:none;font:bold 15px Arial">Conferir gestão</a></p>'
    )
    (saida / "favorito-conferir-gestao.html").write_text(html, encoding="utf-8")
    print(f"favorito gerado ({len(url)} caracteres)")


if __name__ == "__main__":
    main()
