"""Monta para-colar/atualizar-links.js (fora do git) a partir de ferramentas/atualizar-links.js, com o token
do arquivo .token-evento (origem 903), os clientes da exportação da gestão (ID e cidade/UF) e os dados de
empresa das fichas originais (saida/fichas/empresas-das-fichas.json, gerado por comparar-fichas.py).

Uso:
  python3 -I ferramentas/gerar-links.py EXPORTACAO_GESTAO.csv [ID_DO_TIPO_DE_EVENTO]
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
    clientes = {}
    with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            pid = r["Identificador da pessoa"].strip()
            if not pid:
                continue
            c = clientes.setdefault(pid, {"p": pid})
            cidade, uf = valor(r.get("Cidade")), valor(r.get("UF"))
            if cidade and "c" not in c:
                c["c"] = f"{cidade} - {uf}" if uf else cidade
    empresas = json.loads((RAIZ / "saida" / "fichas" / "empresas-das-fichas.json").read_text(encoding="utf-8"))
    js = (RAIZ / "ferramentas" / "atualizar-links.js").read_text(encoding="utf-8")
    js = js.replace("__CLIENTES__", json.dumps(list(clientes.values()), ensure_ascii=False, separators=(",", ":")))
    js = js.replace("__EMPRESAS__", json.dumps(empresas, ensure_ascii=False, separators=(",", ":")))
    token = (RAIZ / ".token-evento").read_text(encoding="utf-8").strip()
    js = js.replace("token: 'COLE_O_TOKEN_AQUI'", f"token: '{token}'", 1)
    if len(sys.argv) > 2:
        js = js.replace("eventoAtualizaLink: ''", f"eventoAtualizaLink: '{sys.argv[2]}'", 1)
    saida = RAIZ / "para-colar"
    saida.mkdir(exist_ok=True)
    (saida / "atualizar-links.js").write_text(js, encoding="utf-8")
    (saida / "atualizar-links.txt").write_text(js, encoding="utf-8")
    print(f"clientes: {len(clientes)} | com ficha original: {len(empresas)}")


if __name__ == "__main__":
    main()
