"""Gera preview/index.html: simula o formulário do Rubeus (estrutura genérica
label + input, só os campos) com o CSS e o JS do projeto, para testar
localmente. Uso: python3 ferramentas/gerar-preview.py"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

FAIXAS = ["Até R$1M", "De R$1M a R$10M", "De R$10M a R$50M", "De R$50M a R$100M", "Acima de R$100M"]
REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Imune / Isento"]

ESTRUTURA = [
    ("Nome *", "text", "pessoa.nome"), ("CNPJ *", "text", "pessoa.cnpj"),
    ("CEP *", "text", "pessoa.cep"),
    ("Endereço sede completo *", "text", "pessoa.endereco"),
    ("Número *", "text", "pessoa.numero"),
    ("Complemento", "text", "contato.camposPersonalizados.campopersonalizado_122_compl_cont"),
    ("Bairro *", "text", "pessoa.bairro"),
    ("Inscrição Estadual", "text", "contato.camposPersonalizados.campopersonalizado_127_compl_cont"),
    ("Inscrição Municipal", "text", "contato.camposPersonalizados.campopersonalizado_126_compl_cont"),
    ("Cidade/Estado *", "text", "pessoa.cidade"),
    ("Faturamento bruto anual¹", FAIXAS, "processo.camposPersonalizados.campopersonalizado_554_compl_proc"),
    ("Regime de Tributação", REGIMES, "processo.camposPersonalizados.campopersonalizado_556_compl_proc"),
    ("Nome *", "text", "processo.camposPersonalizados.campopersonalizado_386_compl_proc"),
    ("E-mail *", "text", "processo.camposPersonalizados.campopersonalizado_388_compl_proc"),
    ("CPF *", "text", "processo.camposPersonalizados.campopersonalizado_564_compl_proc"),
    ("Telefone *", "tel-iti", "processo.camposPersonalizados.campopersonalizado_453_compl_proc"),
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
    ("RpR - Link Ficha (PDF)", "textarea", "processo.camposPersonalizados.campopersonalizado_585_compl_proc"),
]


def campo(i, label, tipo, nome):
    if isinstance(tipo, list):
        ops = "".join(f"<option>{o}</option>" for o in ["Selecione"] + tipo)
        ctrl = f'<select id="c{i}" name="{nome}">{ops}</select>'
    elif tipo == "textarea":
        ctrl = f'<textarea id="c{i}" name="{nome}"></textarea>'
    elif tipo == "tel-iti":
        ctrl = (f'<div class="iti" style="position:relative"><div class="iti__flag-container" style="position:absolute;left:0;top:0;bottom:0;width:46px;display:flex;align-items:center;justify-content:center;background:#eee"><div class="iti__selected-flag">BR</div></div>'
                f'<input id="c{i}" name="{nome}" type="tel" style="padding-left:52px"></div>')
    else:
        ctrl = f'<input id="c{i}" name="{nome}" type="{tipo}">'
    return f'<div class="form-group"><label for="c{i}">{label}</label><div class="wrap" style="width:340px">{ctrl}</div></div>'


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
<style>body{{margin:0;padding:0 16px 40px;background:#fff}}
button{{margin-top:16px;padding:10px 24px;background:#12857f;color:#fff;border:0;border-radius:4px}}</style>
</head><body><form onsubmit="return false">
{chr(10).join(partes)}
</form><script src="../js/body.js"></script></body></html>
"""
(RAIZ / "preview").mkdir(exist_ok=True)
(RAIZ / "preview" / "index.html").write_text(html, encoding="utf-8")
print("preview/index.html gerado")
