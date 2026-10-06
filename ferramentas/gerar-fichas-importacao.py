"""Gera, a partir da exportação do processo de gestão, a planilha de importação do Rubeus com o
link da ficha de cada cliente preenchido no campo "RpR - Link Ficha (PDF)".

Uso:
  python3 -I ferramentas/gerar-fichas-importacao.py EXPORTACAO.csv MODELO.csv PASTA_SAIDA [LINK_BASE]

Saída (fica fora do git, contém dados de clientes):
  importacao-fichas.csv  -> modelo do Rubeus, separado por ';'
  relatorio.csv          -> todos os clientes, com o link e o que foi ou não incluído
"""
import base64
import csv
import json
import re
import sys
import zlib
from datetime import datetime, timezone
from pathlib import Path

LINK_BASE = "https://rbacademy.apprbs.com.br/ficha_cadastral"

PAPEIS = [
    ("Responsável pelo projeto", "(Contato principal)", ["Contato_Relacionado_clienteResponsavelDoProjeto"], ["Nome", "E-mail", "CPF", "Telefone"]),
    ("Representante(s) legal(is)", "(responsável(is) pela assinatura)",
     ["Contato_Relacionado_clienteResponsavelLegal", "Contato_Relacionado_responsavelLegal"], ["Nome", "E-mail", "CPF", "Telefone"]),
    ("Testemunha(s)", "", ["Contato_Relacionado_clienteTestemunhaContratual"], ["Nome", "E-mail", "CPF", "Telefone"]),
    ("Responsável financeiro", "(recebimento de NFs)",
     ["Contato_Relacionado_clienteGerenteFinanceiro", "Contato_Relacionado_clienteFinanceiro",
      "Contato_Relacionado_responsavelFinanceiro"], ["Nome", "E-mail", "Telefone"]),
]


def valor(v):
    v = (v or "").strip()
    return "" if v in ("", "-", "--", "- - -") else v


def digitos(v):
    return re.sub(r"\D", "", v or "")


def cnpj_valido(d):
    if len(d) != 14 or len(set(d)) == 1:
        return False
    for t in (12, 13):
        pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2][13 - t:]
        s = sum(int(d[i]) * pesos[i] for i in range(t))
        if (0 if s % 11 < 2 else 11 - s % 11) != int(d[t]):
            return False
    return True


def cnpj_completo(*valores):
    """CNPJ com 14 dígitos (a exportação perde os zeros à esquerda). Retorna (formatado, valido)."""
    for v in valores:
        d = digitos(valor(v))
        if d and len(d) <= 14:
            d = d.zfill(14)
            return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}", cnpj_valido(d)
    return "", False


def cnpj_formatado(v):
    return cnpj_completo(v)[0] or v


def nomes(texto):
    vistos, out = set(), []
    for n in (texto or "").split("|"):
        n = valor(n)
        if n and n.lower() not in vistos:
            vistos.add(n.lower())
            out.append(n)
    return out


def juntar(linhas):
    """Une as linhas do mesmo cliente, ficando com o primeiro valor preenchido de cada coluna."""
    base = dict(linhas[0])
    for outra in linhas[1:]:
        for k, v in outra.items():
            if not valor(base.get(k)) and valor(v):
                base[k] = v
            elif k.startswith("Contato_Relacionado_") and valor(v) and valor(v) not in valor(base.get(k)):
                base[k] = valor(base.get(k)) + " | " + valor(v)
    return base


def montar_ficha(r):
    cidade = valor(r.get("Cidade"))
    uf = valor(r.get("UF"))
    dados = [
        ["Nome", valor(r.get("Nome da pessoa"))],
        ["CNPJ", cnpj_completo(r.get("RpR - CNPJ"), r.get("CNPJ"))[0]],
    ]
    if valor(r.get("RpR - Razão Social")):
        dados.append(["Razão social", valor(r["RpR - Razão Social"])])
    dados += [
        ["CEP", ""],
        ["Endereço sede completo", valor(r.get("Endereço"))],
        ["Número", valor(r.get("Número"))],
        ["Complemento", valor(r.get("RpR - Complemento"))],
        ["Bairro", valor(r.get("Bairro"))],
        ["Inscrição Estadual", valor(r.get("RpR - Inscrição Estadual"))],
        ["Inscrição Municipal", valor(r.get("RpR - Inscrição Municipal"))],
        ["Cidade/Estado", f"{cidade} - {uf}" if cidade and uf else cidade or uf],
        ["Faturamento bruto anual¹", ""],
        ["Regime de Tributação", ""],
    ]
    secoes = [["Dados cadastrais do cliente", dados, ""]]
    for titulo, detalhe, colunas, campos in PAPEIS:
        pessoas = []
        for c in colunas:
            for n in nomes(r.get(c)):
                if n.lower() not in [p.lower() for p in pessoas]:
                    pessoas.append(n)
        linhas = []
        for i, nome in enumerate(pessoas or [""]):
            sufixo = f" ({i + 1}º)" if i else ""
            for campo in campos:
                linhas.append([campo + sufixo, nome if campo == "Nome" else ""])
        secoes.append([titulo, linhas, detalhe])
    secoes.append(["Informações gerais", [["Observação", ""]], ""])
    return {"v": 1, "o": "importacao", "t": datetime.now(timezone.utc).isoformat(), "s": secoes}


def link_da_ficha(ficha, base):
    bruto = json.dumps(ficha, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    dado = comp.compress(bruto) + comp.flush()
    b64 = base64.urlsafe_b64encode(dado).decode().rstrip("=")
    return f"{base}?ficha=z.{b64}"


def main():
    exportacao, modelo, saida = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    base = sys.argv[4] if len(sys.argv) > 4 else LINK_BASE
    saida.mkdir(parents=True, exist_ok=True)

    with exportacao.open(encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    with modelo.open(encoding="utf-8-sig", newline="") as f:
        cabecalho = next(csv.reader(f, delimiter=";"))

    grupos = {}
    for r in linhas:
        grupos.setdefault(r["Identificador da pessoa"], []).append(r)

    col = {
        "nome": "Nome*", "email": "Email", "telefone": "Telefone",
        "natureza": "Natureza jurídica(PF ou PJ, 1 ou 2, Pessoa Física ou Pessoa Jurídica)",
        "cnpj": "CNPJ", "link": "RpR - Link Ficha (PDF) (Registro de processo)",
    }
    for c in col.values():
        assert c in cabecalho, f"coluna não encontrada no modelo: {c}"

    importar, relatorio = [], []
    for pid, grupo in grupos.items():
        r = juntar(grupo)
        nome = valor(r.get("Nome da pessoa"))
        email = valor(r.get("E-mail da pessoa"))
        tel = digitos(valor(r.get("Telefone da pessoa")))
        link = link_da_ficha(montar_ficha(r), base)
        cnpj, cnpj_ok = cnpj_completo(r.get("RpR - CNPJ"), r.get("CNPJ"))
        situacao = "incluído"
        if not nome:
            situacao = "fora: sem nome"
        elif not email and not tel:
            situacao = "fora: sem e-mail e sem telefone"
        relatorio.append({"Identificador da pessoa": pid, "Nome": nome, "CNPJ": cnpj,
                          "CNPJ válido": "sim" if cnpj_ok else ("sem CNPJ" if not cnpj else "NÃO"),
                          "E-mail": email, "Telefone": tel,
                          "Registros na exportação": len(grupo), "Situação": situacao,
                          "Tamanho do link": len(link), "Link da ficha": link})
        if situacao != "incluído":
            continue
        linha = {c: "" for c in cabecalho}
        linha[col["nome"]] = nome
        linha[col["email"]] = email
        linha[col["telefone"]] = tel
        linha[col["natureza"]] = "2"
        linha[col["cnpj"]] = cnpj
        linha[col["link"]] = link
        importar.append(linha)

    with (saida / "importacao-fichas.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cabecalho, delimiter=";", lineterminator="\n")
        w.writeheader()
        w.writerows(importar)
    with (saida / "relatorio.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(relatorio[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(relatorio)

    print(f"clientes: {len(grupos)} | na importação: {len(importar)} | fora: {len(grupos) - len(importar)}")
    for r in relatorio:
        if r["Situação"] != "incluído":
            print(" -", r["Nome"], "->", r["Situação"])
    print("maior link:", max(r["Tamanho do link"] for r in relatorio), "caracteres")
    print("CNPJ completados com zero:", sum(1 for r in relatorio if r["CNPJ"].startswith("0")))
    for r in relatorio:
        if r["CNPJ válido"] != "sim":
            print(" - CNPJ", r["CNPJ válido"], ":", r["Nome"], r["CNPJ"])


if __name__ == "__main__":
    main()
