# Ficha Cadastral Rubeus (formulário)

Recria a "Ficha Cadastral Rubeus" (antes em .docx) dentro do **Modelo de formulário** do Rubeus.

**Como funciona:** os campos são os campos nativos do Rubeus, arrastados no editor. Assim o envio,
a validação e a gravação no CRM continuam sendo do Rubeus. O visual de tabela da ficha
(rótulo | campo), as máscaras e os títulos de seção ficam por conta dos blocos abaixo.

| Arquivo | Onde colar no Rubeus |
|---|---|
| `css/ficha.css` | Edição avançada → **CSS** |
| `js/body.js` | Edição avançada → **Javascript em Body** |
| `html/01…08-*.html` | Um bloco **HTML** do editor para cada arquivo, na ordem abaixo |
| `ferramentas/listar-campos.js` | Console do navegador (F12), para listar os campos do form |
| `preview/index.html` | Simulação local para conferir o visual (`python3 ferramentas/gerar-preview.py`) |

> Se o editor de CSS/JS pedir tags, envolva o conteúdo em `<style>…</style>` / `<script>…</script>`.
> Desligue o "Incluir script que exija a aceitação de cookies" para o JS do body: ele não rastreia
> nada e precisa rodar sempre, senão o layout e as máscaras só aparecem depois do aceite.

## Ordem dos blocos no editor

1. HTML `01-cabecalho.html`
2. HTML `02-secao-dados-cliente.html`
   - Nome · CNPJ · Endereço sede completo · Inscrição Estadual · Inscrição Municipal ·
     Faturamento bruto anual¹ (seleção) · Regime de Tributação (seleção)
3. HTML `03-secao-responsavel-projeto.html`
   - Responsável pelo projeto - Nome · - E-mail · - CPF · - Telefone
4. HTML `04-secao-representante-legal.html`
   - Representante legal - Nome · - E-mail · - CPF · - Telefone
5. HTML `05-secao-testemunha.html`
   - Testemunha - Nome · - E-mail · - CPF · - Telefone
6. HTML `06-secao-responsavel-financeiro.html`
   - Responsável financeiro - Nome · - E-mail · - Telefone
7. HTML `07-informacoes-gerais.html`
   - Observações (texto longo)
   - (opcional) aceite / checkbox de declaração
8. HTML `08-nota-e-rodape.html`, depois do botão de enviar

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
