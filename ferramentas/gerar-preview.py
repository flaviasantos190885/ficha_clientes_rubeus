"""Gera preview/index.html: simula o formulário do Rubeus (estrutura genérica
label + input) com os blocos HTML, o CSS e o JS do projeto, para testar
localmente. Uso: python3 ferramentas/gerar-preview.py"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
blocos = {p.name[:2]: p.read_text(encoding="utf-8") for p in sorted((RAIZ / "html").glob("*.html"))}

FAIXAS = ["Até R$1M", "De R$1M a R$10M", "De R$10M a R$50M", "De R$50M a R$100M", "Acima de R$100M"]
REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Imune / Isento"]

ESTRUTURA = [
    ("02", [("Nome", "text"), ("CNPJ", "text"), ("Endereço sede completo", "text"),
            ("Inscrição Estadual", "text"), ("Inscrição Municipal", "text"),
            ("Faturamento bruto anual¹", FAIXAS), ("Regime de Tributação", REGIMES)]),
    ("03", [("Responsável pelo projeto - Nome", "text"), ("Responsável pelo projeto - E-mail", "email"),
            ("Responsável pelo projeto - CPF", "text"), ("Responsável pelo projeto - Telefone", "tel")]),
    ("04", [("Representante legal - Nome", "text"), ("Representante legal - E-mail", "email"),
            ("Representante legal - CPF", "text"), ("Representante legal - Telefone", "tel")]),
    ("05", [("Testemunha - Nome", "text"), ("Testemunha - E-mail", "email"),
            ("Testemunha - CPF", "text"), ("Testemunha - Telefone", "tel")]),
    ("06", [("Responsável financeiro - Nome", "text"), ("Responsável financeiro - E-mail", "email"),
            ("Responsável financeiro - Telefone", "tel")]),
    ("07", [("Observações", "textarea")]),
]


def campo(i, label, tipo):
    if isinstance(tipo, list):
        ops = "".join(f"<option>{o}</option>" for o in ["Selecione"] + tipo)
        ctrl = f'<select id="c{i}" name="c{i}">{ops}</select>'
    elif tipo == "textarea":
        ctrl = f'<textarea id="c{i}" name="c{i}"></textarea>'
    else:
        ctrl = f'<input id="c{i}" name="c{i}" type="{tipo}">'
    return f'<div class="form-group"><label for="c{i}">{label}</label>{ctrl}</div>'


partes, i = [f'<div class="bloco-html">{blocos["01"]}</div>'], 0
for bloco, campos in ESTRUTURA:
    partes.append(f'<div class="bloco-html">{blocos[bloco]}</div>')
    for label, tipo in campos:
        i += 1
        partes.append(campo(i, label, tipo))
partes.append('<div class="form-group"><label><input type="checkbox" name="aceite"> Declaro que as informações são verdadeiras.</label></div>')
partes.append('<button type="submit">Enviar</button>')
partes.append(f'<div class="bloco-html">{blocos["08"]}</div>')

html = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview ficha cadastral</title>
<link rel="stylesheet" href="../css/ficha.css">
<style>body{{max-width:760px;margin:0 auto;padding:0 16px 40px;background:#fff}}
button{{margin-top:16px;padding:10px 24px;background:#12857f;color:#fff;border:0;border-radius:4px}}</style>
</head><body><form onsubmit="return false">
{chr(10).join(partes)}
</form><script src="../js/body.js"></script></body></html>
"""
(RAIZ / "preview").mkdir(exist_ok=True)
(RAIZ / "preview" / "index.html").write_text(html, encoding="utf-8")
print("preview/index.html gerado")
