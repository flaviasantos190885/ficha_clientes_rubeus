"""Atualiza a linha `var IMG = {...};` de js/body.js e visualizador/body.js com as imagens de img/ em base64.
Uso: python3 ferramentas/embutir-imagens.py"""
import base64, json, re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOMES = {
    "logo": "logo-rubeus.png", "hexagono": "fundo-hexagono.png", "topo": "faixa-topo.png",
    "base": "faixa-base.png", "tel": "icone-tel.png", "web": "icone-web.png", "local": "icone-local.png",
}
img = {k: "data:image/png;base64," + base64.b64encode((RAIZ / "img" / v).read_bytes()).decode() for k, v in NOMES.items()}
linha = "  var IMG = " + json.dumps(img, separators=(",", ":")) + ";"
for arq in ["js/body.js", "visualizador/body.js"]:
    p = RAIZ / arq
    s = p.read_text(encoding="utf-8")
    s, n = re.subn(r"^  var IMG = .*;$", lambda m: linha, s, count=1, flags=re.M)
    assert n == 1, arq
    p.write_text(s, encoding="utf-8")
    print(arq, "ok")
