"""Gera preview/index.html: simula o formulário do Rubeus (estrutura genérica
label + input, só os campos) com o CSS e o JS do projeto, para testar
localmente. Uso: python3 ferramentas/gerar-preview.py"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

FAIXAS = ["Até R$1M", "De R$1M a R$10M", "De R$10M a R$50M", "De R$50M a R$100M", "Acima de R$100M"]
REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Imune / Isento"]

ESTRUTURA = [
    ("Nome *", "text", "pessoa.nome"), ("CNPJ *", "text", "pessoa.cnpj"),
    ("Endereço sede completo *", "text", "pessoa.endereco"),
    ("Inscrição Estadual", "text", "contato.camposPersonalizados.ie"),
    ("Inscrição Municipal", "text", "contato.camposPersonalizados.im"),
    ("Faturamento bruto anual¹", FAIXAS, "contato.camposPersonalizados.fat"),
    ("Regime de Tributação", REGIMES, "contato.camposPersonalizados.reg"),
    ("Nome *", "text", "processo.camposPersonalizados.rp_nome"),
    ("E-mail do responsável pelo projeto *", "text", "processo.camposPersonalizados.rp_email"),
    ("CPF do responsável pelo projeto", "text", "processo.camposPersonalizados.rp_cpf"),
    ("Telefone do responsável pelo projeto", "text", "processo.camposPersonalizados.rp_tel"),
    ("Nome do representante legal", "text", "processo.camposPersonalizados.rl_nome"),
    ("E-mail do representante legal", "text", "processo.camposPersonalizados.rl_email"),
    ("CPF do representante legal", "text", "processo.camposPersonalizados.rl_cpf"),
    ("Telefone do representante legal", "text", "processo.camposPersonalizados.rl_tel"),
    ("Nome da testemunha", "text", "processo.camposPersonalizados.t_nome"),
    ("E-mail da testemunha", "text", "processo.camposPersonalizados.t_email"),
    ("CPF da testemunha", "text", "processo.camposPersonalizados.t_cpf"),
    ("Telefone da testemunha", "text", "processo.camposPersonalizados.t_tel"),
    ("Nome do responsável financeiro", "text", "processo.camposPersonalizados.f_nome"),
    ("E-mail do responsável financeiro", "text", "processo.camposPersonalizados.f_email"),
    ("Telefone do responsável financeiro", "text", "processo.camposPersonalizados.f_tel"),
    ("Observações", "textarea", "processo.camposPersonalizados.obs"),
]


def campo(i, label, tipo, nome):
    if isinstance(tipo, list):
        ops = "".join(f"<option>{o}</option>" for o in ["Selecione"] + tipo)
        ctrl = f'<select id="c{i}" name="{nome}">{ops}</select>'
    elif tipo == "textarea":
        ctrl = f'<textarea id="c{i}" name="{nome}"></textarea>'
    else:
        ctrl = f'<input id="c{i}" name="{nome}" type="{tipo}">'
    return f'<div class="form-group"><label for="c{i}">{label}</label>{ctrl}</div>'


partes, i = [], 0
for label, tipo, nome in ESTRUTURA:
    i += 1
    partes.append(campo(i, label, tipo, nome))
partes.append('<div class="form-group"><label><input type="checkbox" name="aceite"> Declaro que as informações são verdadeiras.</label></div>')
partes.append('<button type="submit">Enviar</button>')

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
