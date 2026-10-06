"""Monta para-colar/migrar-fichas.js (fora do git) a partir de ferramentas/migrar-fichas.js, com o
token do arquivo .token e a lista de clientes (ids da pessoa e dos registros) da exportação da gestão.

Uso:
  python3 -I ferramentas/gerar-migracao.py EXPORTACAO.csv [ID_TIPO_DE_EVENTO]
"""
import csv
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def main():
    exportacao = Path(sys.argv[1])
    evento = sys.argv[2] if len(sys.argv) > 2 else ""
    with exportacao.open(encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    clientes = {}
    for r in linhas:
        pid, reg = r["Identificador da pessoa"].strip(), r["Identificador"].strip()
        if pid and reg and reg not in clientes.setdefault(pid, []):
            clientes[pid].append(reg)
    lista = [{"p": p, "r": rs} for p, rs in clientes.items()]

    js = (RAIZ / "ferramentas" / "migrar-fichas.js").read_text(encoding="utf-8")
    js = js.replace("__CLIENTES__", json.dumps(lista, separators=(",", ":")))
    token = (RAIZ / ".token").read_text(encoding="utf-8").strip()
    js = js.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    if evento:
        js = js.replace("eventoCriaFicha: 'COLE_O_TIPO_DE_EVENTO'", f"eventoCriaFicha: '{evento}'", 1)

    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (saida / "migrar-fichas.js").write_text(js, encoding="utf-8")
    (saida / "migrar-fichas-js.txt").write_text(js, encoding="utf-8")
    print(f"clientes: {len(lista)} | registros: {sum(len(c['r']) for c in lista)}")


if __name__ == "__main__":
    main()
