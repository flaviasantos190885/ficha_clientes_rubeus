"""Gera para-colar/body.js com o token (arquivo .token, fora do git). Uso: python3 ferramentas/gerar-para-colar.py"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
token = (RAIZ / ".token").read_text(encoding="utf-8").strip()
js = (RAIZ / "js" / "body.js").read_text(encoding="utf-8")
alvo = "token: 'COLE_O_TOKEN_AQUI'"
assert js.count(alvo) == 1
(RAIZ / "para-colar").mkdir(exist_ok=True)
(RAIZ / "para-colar" / "body.js").write_text(js.replace(alvo, "token: '" + token + "'"), encoding="utf-8")
(RAIZ / "para-colar" / "ficha.css").write_text((RAIZ / "css" / "ficha.css").read_text(encoding="utf-8"), encoding="utf-8")
print("para-colar/ gerado")
(RAIZ / "para-colar" / "body-js.txt").write_text((RAIZ / "para-colar" / "body.js").read_text(encoding="utf-8"), encoding="utf-8")
(RAIZ / "para-colar" / "ficha-css.txt").write_text((RAIZ / "para-colar" / "ficha.css").read_text(encoding="utf-8"), encoding="utf-8")
