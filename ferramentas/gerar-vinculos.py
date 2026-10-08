"""Monta para-colar/vincular-fichas.js (fora do git) a partir de ferramentas/vincular-fichas.js, com o
token do arquivo .token e as pessoas de saida/fichas/pessoas-para-vincular.json (gerado por
comparar-fichas.py). Só entram os clientes encontrados pelo CNPJ.

Uso:
  python3 -I ferramentas/gerar-vinculos.py [pessoas-para-vincular.json]
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def main():
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "saida" / "fichas" / "pessoas-para-vincular.json"
    dados = [c for c in json.loads(origem.read_text(encoding="utf-8")) if c["como"].startswith("CNPJ")]
    campos = ("nome", "email", "cpf", "telefone", "tipo", "situacao")
    for c in dados:
        c["pessoas"] = [{k: p.get(k, "") for k in campos} for p in c["pessoas"]]
        c.pop("arquivo", None)
    js = (RAIZ / "ferramentas" / "vincular-fichas.js").read_text(encoding="utf-8")
    js = js.replace("__DADOS__", json.dumps(dados, ensure_ascii=False, separators=(",", ":")))
    token = (RAIZ / ".token").read_text(encoding="utf-8").strip()
    js = js.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (saida / "vincular-fichas.js").write_text(js, encoding="utf-8")
    (saida / "vincular-fichas.txt").write_text(js, encoding="utf-8")
    print(f"clientes: {len(dados)} | pessoas: {sum(len(c['pessoas']) for c in dados)}")


if __name__ == "__main__":
    main()
