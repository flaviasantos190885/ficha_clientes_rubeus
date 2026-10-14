"""Monta o favorito "Enviar para Fichas" (fora do git, leva os tokens): junta os scripts de migração,
sincronização de vínculos e atualização de link, já gerados em para-colar/, mais ferramentas/favorito.js.

Antes, gere os três scripts:
  python3 -I ferramentas/gerar-migracao.py EXPORTACAO.csv 4540
  python3 -I ferramentas/gerar-sincronizar.py EXPORTACAO.csv
  python3 -I ferramentas/gerar-links.py EXPORTACAO.csv 4540
Depois:
  python3 -I ferramentas/gerar-favorito.py

Saída: para-colar/instalar-favorito.html (abra no Chrome e arraste o botão para a barra de favoritos).
"""
import html
import re
from pathlib import Path
from urllib.parse import quote

RAIZ = Path(__file__).resolve().parent.parent


def main():
    pasta = RAIZ / "para-colar"
    partes = [(pasta / n).read_text(encoding="utf-8") for n in ("migrar-fichas.js", "sincronizar-vinculos.js", "atualizar-links.js")]
    for i in (0, 1):
        partes[i] = re.sub(r"var CLIENTES = \[.*?\];\n", "var CLIENTES = [];\n", partes[i], count=1, flags=re.S)
    orquestrador = (RAIZ / "ferramentas" / "favorito.js").read_text(encoding="utf-8")
    token = (RAIZ / ".token-evento").read_text(encoding="utf-8").strip()
    orquestrador = orquestrador.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    codigo = "\n;\n".join(partes + [orquestrador])
    (pasta / "favorito.js").write_text(codigo, encoding="utf-8")
    href = "javascript:" + quote("(function(){" + codigo + "\n})();", safe=" !$&'()*+,-./:;<=>?@[]^_`{|}~\"")
    pagina = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Instalar favorito</title>
<style>body{{font:15px/1.5 Arial,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#222}}
a.botao{{display:inline-block;background:#12857f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold}}</style></head>
<body><h2>Favorito "Enviar para Fichas"</h2>
<ol><li>Mostre a barra de favoritos do Chrome (Ctrl+Shift+B).</li>
<li><b>Arraste</b> o botão abaixo até a barra de favoritos.</li>
<li>Na Rubeus, abra o contato da empresa (cliente) e clique no favorito.</li></ol>
<p><a class="botao" href="{html.escape(href, quote=True)}">Enviar para Fichas</a></p>
<p style="color:#666">Este arquivo tem o token da Rubeus. Não compartilhe.</p>
</body></html>"""
    (pasta / "instalar-favorito.html").write_text(pagina, encoding="utf-8")
    print(f"favorito: {len(href)} caracteres")


if __name__ == "__main__":
    main()
