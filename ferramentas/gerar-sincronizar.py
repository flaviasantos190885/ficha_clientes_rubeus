"""Monta para-colar/sincronizar-vinculos.js (fora do git) a partir de ferramentas/sincronizar-vinculos.js,
com o token do arquivo .token-evento (origem 903) e os IDs dos clientes da exportação da gestão.

Uso:
  python3 -I ferramentas/gerar-sincronizar.py EXPORTACAO_GESTAO.csv
"""
import csv
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def main():
    with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
        ids = list(dict.fromkeys(r["Identificador da pessoa"].strip() for r in csv.DictReader(f) if r["Identificador da pessoa"].strip()))
    js = (RAIZ / "ferramentas" / "sincronizar-vinculos.js").read_text(encoding="utf-8")
    js = js.replace("__CLIENTES__", json.dumps(ids))
    token = (RAIZ / ".token-evento").read_text(encoding="utf-8").strip()
    js = js.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (saida / "sincronizar-vinculos.js").write_text(js, encoding="utf-8")
    (saida / "sincronizar-vinculos.txt").write_text(js, encoding="utf-8")
    print(f"clientes: {len(ids)}")


if __name__ == "__main__":
    main()
