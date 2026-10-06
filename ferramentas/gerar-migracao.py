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


def valor(v):
    v = (v or "").strip()
    return "" if v in ("", "-", "--", "- - -") else v


def main():
    exportacao = Path(sys.argv[1])
    evento = sys.argv[2] if len(sys.argv) > 2 else ""
    with exportacao.open(encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    clientes, cidades = {}, {}
    for r in linhas:
        pid, reg = r["Identificador da pessoa"].strip(), r["Identificador"].strip()
        if pid and reg and reg not in clientes.setdefault(pid, []):
            clientes[pid].append(reg)
        cidade, uf = valor(r.get("Cidade")), valor(r.get("UF"))
        if pid and cidade and pid not in cidades:
            cidades[pid] = f"{cidade} - {uf}" if uf else cidade
    lista = []
    for p, rs in clientes.items():
        item = {"p": p, "r": rs}
        if p in cidades:
            item["c"] = cidades[p]
        lista.append(item)

    js = (RAIZ / "ferramentas" / "migrar-fichas.js").read_text(encoding="utf-8")
    js = js.replace("__CLIENTES__", json.dumps(lista, separators=(",", ":")))
    token = (RAIZ / ".token").read_text(encoding="utf-8").strip()
    js = js.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    token_evento = RAIZ / ".token-evento"
    if token_evento.exists():
        js = js.replace("eventoToken: 'COLE_O_TOKEN_DO_EVENTO'", f"eventoToken: '{token_evento.read_text(encoding='utf-8').strip()}'", 1)
    if evento:
        js = js.replace("eventoCriaFicha: 'COLE_O_TIPO_DE_EVENTO'", f"eventoCriaFicha: '{evento}'", 1)

    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (saida / "migrar-fichas.js").write_text(js, encoding="utf-8")
    (saida / "migrar-fichas-js.txt").write_text(js, encoding="utf-8")
    print(f"clientes: {len(lista)} | registros: {sum(len(c['r']) for c in lista)}")


if __name__ == "__main__":
    main()
