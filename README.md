# Ficha Cadastral Rubeus (formulário)

Recria a "Ficha Cadastral Rubeus" (antes em .docx) dentro do **Modelo de formulário** do Rubeus.

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
   - Responsável pelo projeto - Nome · - E-mail · - CPF · - Telefone
   - Representante legal - Nome · - E-mail · - CPF · - Telefone
   - Testemunha - Nome · - E-mail · - CPF · - Telefone
   - Responsável financeiro - Nome · - E-mail · - Telefone
   - Observações (texto longo)
4. Salve e abra em Pré-visualizar.

> Se o editor de CSS/JS pedir tags, envolva o conteúdo em `<style>…</style>` / `<script>…</script>`.

Outros arquivos:
- `ferramentas/listar-campos.js`: cole no Console (F12) da pré-visualização para listar os campos.
- `preview/index.html`: simulação local (`python3 ferramentas/gerar-preview.py`).

Os títulos aparecem antes do primeiro campo cujo rótulo começa com "Responsável pelo projeto",
"Representante", "Testemunha", "Responsável financeiro" e "Observa…". Para mudar textos ou
regras, edite `BLOCOS` e `RODAPE` no topo do `js/body.js`.

## Rótulos dos campos

Como vários campos se repetem ("Nome", "E-mail", "CPF"…), no Rubeus eles precisam de nomes únicos.
Use o padrão **`Seção - Campo`** (hífen com espaços). O JS mostra só a parte depois do último
` - `, então "Responsável pelo projeto - CPF" aparece como **CPF**, igual ao PDF. O nome completo
continua no CRM.

Máscaras automáticas pelo rótulo: **CNPJ**, **CPF** (com validação dos dígitos), **CEP** e
**Telefone/Celular/WhatsApp**.

Opções sugeridas:
- **Faturamento bruto anual:** Até R$1M · De R$1M a R$10M · De R$10M a R$50M · De R$50M a R$100M · Acima de R$100M
- **Regime de Tributação:** Simples Nacional · Lucro Presumido · Lucro Real · Imune / Isento

## Ajustar aos campos reais

Rode `ferramentas/listar-campos.js` no console da pré-visualização: ele copia um JSON com
label, name, id, tipo e a estrutura HTML de cada campo. Com isso dá para ajustar o CSS/JS à
estrutura exata do Rubeus, se algo não encaixar.
