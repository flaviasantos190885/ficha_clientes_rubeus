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

## Link da ficha (campo 585)

O campo `campopersonalizado_585_compl_proc` (texto longo, fica oculto no form) recebe um link para
`ficha/index.html` com os dados preenchidos dentro do próprio link (depois do `#`, que não é enviado
a nenhum servidor). A página monta a ficha no layout do PDF e tem o botão "Salvar em PDF / Imprimir".
O endereço base fica em `LINK_BASE` no `js/body.js` e precisa apontar para onde `ficha/index.html`
estiver publicado (ex.: GitHub Pages).

## Vínculo do responsável pelo projeto

O JS segura o clique em "Enviar solicitação" (`#rbBtnNext`) e:
1. cadastra o responsável (PF) com os campos 386/388/564/453 (`Contato/cadastro`) — o cliente não é alterado;
2. grava um `evento.codRegistro` em campo oculto e dispara o envio nativo;
3. acha o cliente (resposta do envio, CNPJ ou nome) e o registro (`Contato/listarOportunidades`);
4. vincula o responsável no registro com `Oportunidade/alterarPessoas`, tipo `93`.

Nada aparece na tela; cada passo fica guardado no navegador. Depois de um envio, rode `fichaLog()` no
Console para copiar o registro. Configuração em `RUBEUS` e `VINCULO` no `js/body.js`.

O token não fica no repositório (que é público): `js/body.js` tem `COLE_O_TOKEN_AQUI`, e
`ferramentas/gerar-para-colar.py` gera `para-colar/` (fora do git) com o token do arquivo `.token`.
