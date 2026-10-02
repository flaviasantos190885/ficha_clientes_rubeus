# Ficha Cadastral Rubeus (formulário)

Recria a "Ficha Cadastral Rubeus" (antes em .docx) dentro do **Modelo de formulário** do Rubeus.
Layout pensado para desktop (o Rubeus adapta para celular).

**Como funciona:** os campos são os campos nativos do Rubeus, arrastados no editor. Assim o envio,
a validação e a gravação no CRM continuam sendo do Rubeus. O JS cria sozinho o cabeçalho, os títulos
das seções, as "Informações gerais" e o rodapé, então **não precisa de nenhum bloco HTML**.

## Passo a passo (só 2 colagens)

1. No GitHub, abra `css/ficha.css` → botão **Copy raw file** → cole em Edição avançada → **CSS**.
2. Abra `js/body.js` → **Copy raw file** → cole em Edição avançada → **Javascript em Body**.
   Desligue o "Incluir script que exija a aceitação de cookies" (o script não rastreia nada e
   precisa rodar sempre).
3. Arraste os campos para o formulário nesta ordem:
   - Nome · CNPJ · Endereço sede completo · Inscrição Estadual · Inscrição Municipal ·
     Faturamento bruto anual¹ (seleção) · Regime de Tributação (seleção)
   - Responsável pelo projeto: Nome · E-mail · CPF · Telefone
   - Representante legal: Nome · E-mail · CPF · Telefone
   - Testemunha: Nome · E-mail · CPF · Telefone
   - Responsável financeiro: Nome · E-mail · Telefone
   - Observações (texto longo)
4. Salve e abra em Pré-visualizar.

> Se o editor de CSS/JS pedir tags, envolva o conteúdo em `<style>…</style>` / `<script>…</script>`.

Outros arquivos:
- `ferramentas/listar-campos.js`: cole no Console (F12) da pré-visualização para listar os campos.
- `preview/index.html`: simulação local (`python3 ferramentas/gerar-preview.py`).

## Como o JS encontra as seções

O título de cada seção entra antes do primeiro campo que combinar:

| Seção | Regra |
|---|---|
| Dados cadastrais do cliente | primeiro campo do formulário |
| Responsável pelo projeto | rótulo com "responsável pelo projeto" **ou** `name` começando com `processo.` |
| Representante(s) legal(is) | rótulo com "representante" |
| Testemunha(s) | rótulo com "testemunha" |
| Responsável financeiro | rótulo com "financeiro" |
| Informações gerais | rótulo começando com "Observa" |

Na tela o rótulo é encurtado: "E-mail do responsável pelo projeto" aparece como "E-mail",
"CPF da testemunha" como "CPF" (também vale o padrão "Seção - Campo"). O nome completo continua no CRM.
As regras e textos ficam em `BLOCOS` e `RODAPE`, no início do `js/body.js`.

Máscaras automáticas pelo rótulo: **CNPJ**, **CPF** (com validação dos dígitos), **CEP** e
**Telefone/Celular/WhatsApp**.

Opções sugeridas:
- **Faturamento bruto anual:** Até R$1M · De R$1M a R$10M · De R$10M a R$50M · De R$50M a R$100M · Acima de R$100M
- **Regime de Tributação:** Simples Nacional · Lucro Presumido · Lucro Real · Imune / Isento

## Ajustar aos campos reais

Rode `ferramentas/listar-campos.js` no console da pré-visualização: ele copia um JSON com
label, name, id, tipo e a estrutura HTML de cada campo. Com isso dá para ajustar o CSS/JS à
estrutura exata do Rubeus, se algo não encaixar.

## Endereço pelo CEP

Ao abrir, só o CEP aparece. Com 8 dígitos o JS consulta o ViaCEP, preenche Endereço, Bairro e
Cidade/Estado (formato "Muriaé - MG"), mostra os demais campos e põe o cursor em Número.
Se o CEP não existir, os campos aparecem vazios para preenchimento manual.
Os `name` dos campos ficam em `ENDERECO` no `js/body.js`.
