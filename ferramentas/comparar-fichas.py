"""Compara as pessoas das fichas cadastrais (JSON gerado por ferramentas/ler-fichas.html) com os
contatos vinculados no processo de gestão (exportação CSV).

Uso:
  python3 -I ferramentas/comparar-fichas.py fichas-texto.json EXPORTACAO_GESTAO.csv PASTA_SAIDA

Saída (fica fora do git, contém dados de pessoas):
  comparacao-pessoas.csv   -> uma linha por pessoa da ficha, com a situação na gestão
  comparacao-clientes.csv  -> uma linha por ficha, com o cliente encontrado e o que foi usado
  pessoas-para-vincular.json -> base para o script de vínculo (só fichas casadas com a gestão)
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

PAPEIS = {
    "projeto": {"titulo": "Responsável pelo projeto", "tipo": "93", "colunas": ["Contato_Relacionado_clienteResponsavelDoProjeto"]},
    "legal": {"titulo": "Responsável legal", "tipo": "82", "colunas": ["Contato_Relacionado_clienteResponsavelLegal"]},
    "testemunha": {"titulo": "Testemunha", "tipo": "2", "colunas": ["Contato_Relacionado_clienteTestemunhaContratual"]},
    "financeiro": {"titulo": "Gerente financeiro", "tipo": "78", "colunas": ["Contato_Relacionado_clienteGerenteFinanceiro"]},
}

ROTULOS = r"(Nome|E-?mail|CPF|Telefone|Celular|Whats[Aa]pp)"


def sem_acento(v):
    return "".join(c for c in unicodedata.normalize("NFD", v or "") if unicodedata.category(c) != "Mn")


def norm_nome(v):
    v = re.sub(r"[^a-z ]", " ", sem_acento(v).lower())
    return " ".join(p for p in v.split() if p not in ("de", "da", "do", "das", "dos", "e"))


def digitos(v):
    return re.sub(r"\D", "", v or "")


def valor(v):
    v = (v or "").strip()
    return "" if v in ("", "-", "--", "- - -") else v


def mesmo_nome(a, b):
    a, b = norm_nome(a), norm_nome(b)
    if not a or not b:
        return False
    if a == b:
        return True
    ta, tb = a.split(), b.split()
    curto, longo = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    return len(curto) >= 2 and curto[0] == longo[0] and all(t in longo for t in curto)


def secao_do_titulo(linha):
    l = sem_acento(linha).lower()
    if "|" in linha or len(linha) > 90:
        return None
    if "informacoes gerais" in l:
        return "fim"
    if "testemunha" in l:
        return "testemunha"
    if "financeiro" in l:
        return "financeiro"
    if "juridico" in l or "validador" in l:
        return "juridico"
    if "legal" in l or "representante" in l:
        return "legal"
    if "contato principal" in l or "responsavel pelo projeto" in l:
        return "projeto"
    if "dados do cliente" in l or "dados cadastrais" in l or "dados do parceiro" in l or "ficha cadastral" in l:
        return "cliente"
    return None


def campo(rotulo):
    r = sem_acento(rotulo).lower().strip(" :")
    if r.startswith("nome") or r.startswith("contato principal"):
        return "nome"
    if r.replace("-", "").startswith("email"):
        return "email"
    if r.startswith("cpf"):
        return "cpf"
    if r.startswith("telefone") or r.startswith("celular") or r.startswith("whats"):
        return "telefone"
    if r.startswith("razao social"):
        return "razao"
    if r.startswith("cnpj"):
        return "cnpj"
    return None


def pares(linha):
    if "|" in linha:
        rot, _, val = linha.partition("|")
        return [(rot.strip(), val.strip())]
    partes = re.split(ROTULOS + r"\s*:", linha)
    if len(partes) < 3:
        return []
    return [(partes[i], partes[i + 1].strip()) for i in range(1, len(partes) - 1, 2)]


def ler_ficha(texto):
    cliente, pessoas, secao = {}, [], "cliente"
    atual = None
    for linha in texto.split("\n"):
        linha = linha.strip()
        if not linha:
            continue
        s = secao_do_titulo(linha)
        if s == "fim":
            break
        if s:
            secao, atual = s, None
            continue
        for rot, val in pares(linha):
            c = campo(rot)
            val = valor(val)
            if not c or not val:
                continue
            if sem_acento(rot).lower().startswith("contato principal"):
                secao, atual = "projeto", None
            if secao == "cliente" or c in ("razao", "cnpj"):
                if c == "nome" or c == "razao":
                    cliente.setdefault(c, val)
                elif c == "cnpj":
                    cliente.setdefault("cnpj", val)
                continue
            if c == "nome" or atual is None or c in atual:
                atual = {"papel": secao}
                pessoas.append(atual)
            atual[c] = val
    pessoas = [limpar(p) for p in pessoas if p.get("nome") or p.get("email")]
    return cliente, pessoas


EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")


def cpf_valido(d):
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for t in (9, 10):
        s = sum(int(d[i]) * (t + 1 - i) for i in range(t))
        if (s * 10 % 11) % 10 != int(d[t]):
            return False
    return True


def parece_telefone(v):
    d = digitos(v)
    return 10 <= len(d) <= 13 and not cpf_valido(d[-11:] if len(d) == 11 else "")


def limpar(p):
    """Arruma campos trocados na ficha (telefone no e-mail ou no CPF, e-mail no nome) e marca o que
    precisa de revisão manual (duas pessoas na mesma linha, sem nome e sem e-mail)."""
    bruto = {k: (p.get(k) or "").strip() for k in ("nome", "email", "cpf", "telefone")}
    out = {"papel": p["papel"], "nome": "", "email": "", "cpf": "", "telefone": "", "revisar": ""}
    todos = " ".join(bruto.values())
    m = EMAIL.search(bruto["email"]) or EMAIL.search(todos)
    out["email"] = m.group(0).lower() if m else ""
    d = digitos(bruto["cpf"])
    if cpf_valido(d):
        out["cpf"] = f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    tel = digitos(bruto["telefone"])
    if 10 <= len(tel) <= 13:
        out["telefone"] = tel
    else:
        for k in ("email", "cpf", "nome"):
            if not EMAIL.search(bruto[k]) and parece_telefone(bruto[k]):
                out["telefone"] = digitos(bruto[k])
                break
    nome = EMAIL.sub("", bruto["nome"])
    nome = re.sub(r"(?i)\b(e-?mail|telefone|cpf)\s*:.*$", "", nome).strip(" :-|")
    if sum(c.isdigit() for c in nome) >= 6 or not re.search(r"[A-Za-zÀ-ú]{2}", nome):
        nome = ""
    if "|" in nome or re.search(r"(?i)\s(ou|e)\s.*\s(ou|e)\s|\sou\s", nome) or len(digitos(bruto["cpf"])) > 11:
        out["revisar"] = "mais de uma pessoa na mesma linha"
    out["nome"] = nome or out["email"]
    if not out["nome"]:
        out["revisar"] = "sem nome e sem e-mail"
    return out


def cnpj14(v):
    d = digitos(v)
    return d.zfill(14) if 0 < len(d) <= 14 else ""


def carregar_gestao(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    clientes = {}
    for r in linhas:
        pid = r["Identificador da pessoa"].strip()
        c = clientes.setdefault(pid, {"id": pid, "nome": valor(r.get("Nome da pessoa")), "cnpj": "", "registros": [], "contatos": {}})
        c["cnpj"] = c["cnpj"] or cnpj14(valor(r.get("RpR - CNPJ"))) or cnpj14(valor(r.get("CNPJ")))
        if r["Identificador"] not in c["registros"]:
            c["registros"].append(r["Identificador"])
        for k, v in r.items():
            if k.startswith("Contato_Relacionado_") and valor(v):
                for n in v.split("|"):
                    n = valor(n)
                    if n:
                        c["contatos"].setdefault(k, set()).add(n)
    return clientes


def achar_cliente(ficha_cliente, gestao, nome_arquivo):
    cnpj = cnpj14(ficha_cliente.get("cnpj"))
    if cnpj:
        for c in gestao.values():
            if c["cnpj"] == cnpj:
                return c, "CNPJ"
        raiz = [c for c in gestao.values() if c["cnpj"][:8] == cnpj[:8]]
        if len(raiz) == 1:
            return raiz[0], "CNPJ (mesma raiz, filial diferente)"
    rotulos = [rotulo_arquivo(nome_arquivo), ficha_cliente.get("nome", ""), ficha_cliente.get("razao", "")]
    for rot in rotulos:
        r = norm_empresa(rot)
        if len(r) < 3:
            continue
        achados = [c for c in gestao.values() if any(r == a or re.search(r"\b" + re.escape(r) + r"\b", a) for a in apelidos(c["nome"]))]
        if len(achados) == 1:
            return achados[0], "nome (conferir: CNPJ diferente)" if cnpj else "nome (conferir: ficha sem CNPJ)"
    return None, "não encontrado na gestão" + ("" if cnpj else " (ficha sem CNPJ)")


def norm_empresa(v):
    v = re.sub(r"[^a-z0-9 ]", " ", sem_acento(v).lower())
    return " ".join(t for t in v.split() if t not in ("ltda", "sa", "s", "a", "me", "eireli", "de", "da", "do", "e"))


def apelidos(nome):
    return [norm_empresa(x) for x in [nome] + nome.split("/") if norm_empresa(x)]


def rotulo_arquivo(nome):
    n = re.sub(r"\.(docx?|pdf)$", "", nome, flags=re.I)
    n = re.sub(r"(?i)ficha\s*cadastral(\s*rubeus)?", " ", n)
    return re.sub(r"[_\-–]+", " ", n).strip()


def situacao(pessoa, cliente):
    papel = PAPEIS.get(pessoa["papel"])
    if not papel:
        return "papel fora dos 4 tipos (só informativo)", ""
    for col in papel["colunas"]:
        for n in cliente["contatos"].get(col, ()):
            if mesmo_nome(n, pessoa.get("nome")):
                return "ok", n
    for col, nomes in cliente["contatos"].items():
        for n in nomes:
            if mesmo_nome(n, pessoa.get("nome")):
                if col == "Contato_Relacionado_naoIdentificado":
                    return "vinculado como não identificado (corrigir tipo)", n
                return "vinculado com outro tipo (" + col.replace("Contato_Relacionado_", "") + ") - decidir", n
    return "faltando", ""


def main():
    fichas_json, exportacao, saida = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    saida.mkdir(parents=True, exist_ok=True)
    arquivos = json.loads(fichas_json.read_text(encoding="utf-8"))["arquivos"]
    gestao = carregar_gestao(exportacao)

    lidas = []
    for a in arquivos:
        nome_arq = a["caminho"].split("/")[-1]
        if not a.get("texto"):
            lidas.append({"arquivo": nome_arq, "data": a.get("modificado", ""), "problema": a.get("aviso", "sem texto")})
            continue
        cli, pessoas = ler_ficha(a["texto"])
        gc, como = achar_cliente(cli, gestao, nome_arq)
        lidas.append({"arquivo": nome_arq, "data": a.get("docModificado") or a.get("modificado", ""), "cliente_ficha": cli.get("nome") or cli.get("razao", ""),
                      "cnpj": cli.get("cnpj", ""), "gestao": gc, "como": como, "pessoas": pessoas, "problema": ""})

    por_cliente = {}
    for f in lidas:
        if f.get("gestao"):
            por_cliente.setdefault(f["gestao"]["id"], []).append(f)
    usadas = set()
    for lista in por_cliente.values():
        lista.sort(key=lambda f: f["data"], reverse=True)
        usadas.add(id(lista[0]))

    linhas_cli, linhas_pes, vincular = [], [], []
    for f in lidas:
        g = f.get("gestao")
        usada = id(f) in usadas
        if f["problema"]:
            uso = "não lida: " + f["problema"]
        elif not g:
            uso = f["como"]
        elif usada:
            uso = "usada (mais recente)"
        else:
            uso = "ignorada: existe ficha mais recente do mesmo cliente"
        linhas_cli.append({"Arquivo": f["arquivo"], "Data do arquivo": f["data"][:10], "Cliente na ficha": f.get("cliente_ficha", ""),
                           "CNPJ na ficha": f.get("cnpj", ""), "Cliente na gestão": g["nome"] if g else "", "ID do cliente": g["id"] if g else "",
                           "Encontrado por": f["como"] if g else "", "Uso": uso, "Pessoas lidas": len(f.get("pessoas") or [])})
        if not usada:
            continue
        cli_v = {"cliente": g["id"], "nome": g["nome"], "registros": g["registros"], "arquivo": f["arquivo"], "como": f["como"], "pessoas": []}
        for p in f["pessoas"]:
            sit, nome_gestao = situacao(p, g)
            linhas_pes.append({"Cliente": g["nome"], "ID do cliente": g["id"], "Papel na ficha": PAPEIS.get(p["papel"], {}).get("titulo", p["papel"]),
                               "Nome": p.get("nome", ""), "E-mail": p.get("email", ""), "CPF": p.get("cpf", ""), "Telefone": p.get("telefone", ""),
                               "Situação na gestão": sit, "Nome na gestão": nome_gestao, "Arquivo": f["arquivo"]})
            if p.get("revisar"):
                linhas_pes[-1]["Situação na gestão"] = "revisar: " + p["revisar"]
                continue
            if p["papel"] in PAPEIS and (sit == "faltando" or sit.startswith("vinculado como não identificado")):
                cli_v["pessoas"].append(dict(p, tipo=PAPEIS[p["papel"]]["tipo"], situacao=sit))
        if cli_v["pessoas"]:
            vincular.append(cli_v)

    def gravar(nome, linhas):
        with (saida / nome).open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(linhas[0].keys()), delimiter=";")
            w.writeheader()
            w.writerows(linhas)

    gravar("comparacao-clientes.csv", linhas_cli)
    gravar("comparacao-pessoas.csv", linhas_pes)
    (saida / "pessoas-para-vincular.json").write_text(json.dumps(vincular, ensure_ascii=False, indent=1), encoding="utf-8")

    from collections import Counter
    print("arquivos:", len(lidas), "| usados:", len(usadas), "| clientes da gestão com ficha:", len(por_cliente))
    print("uso:", Counter(l["Uso"].split(":")[0] for l in linhas_cli))
    print("pessoas:", Counter(re.sub(r" \(\w+\) - decidir", " - decidir", l["Situação na gestão"]) for l in linhas_pes))
    print("casadas por:", Counter(l["Encontrado por"] for l in linhas_cli if l["Uso"].startswith("usada")))
    print("clientes com algo a vincular:", len(vincular), "| pessoas a vincular:", sum(len(v["pessoas"]) for v in vincular))


if __name__ == "__main__":
    main()
