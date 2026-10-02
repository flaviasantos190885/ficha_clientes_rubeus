(function () {
  'use strict';

  var SEPARADOR = /\s+[-–—|]\s+/;
  var SUFIXO = /\s+(do|da|dos|das|de)\s+(respons[aá]ve|representante|testemunha)[^*]*/i;
  var IGNORAR = ['hidden', 'submit', 'button', 'reset', 'image'];

  var MASCARAS = [
    { teste: /\bcnpj\b/i, tipo: 'cnpj' },
    { teste: /\bcpf\b/i, tipo: 'cpf' },
    { teste: /\bcep\b/i, tipo: 'cep' },
    { teste: /telefone|celular|whats/i, tipo: 'telefone' }
  ];

  function titulo(texto, detalhe) {
    return '<h2 class="fc-secao">' + texto + (detalhe ? ' <small>' + detalhe + '</small>' : '') + '</h2>';
  }

  var BLOCOS = [
    { antes: 'primeiro', html:
        '<div class="fc-faixa"></div>' +
        '<div class="fc-cabecalho">' +
          '<span class="fc-logo">Rubeus</span>' +
          '<a class="fc-site" href="https://rubeus.com.br" target="_blank" rel="noopener">rubeus.com.br</a>' +
        '</div>' +
        '<h1 class="fc-titulo-ficha">Ficha cadastral</h1>' +
        '<p class="fc-subtitulo-ficha">Preencha os dados abaixo para a formalização do contrato.</p>' +
        titulo('Dados cadastrais do cliente') },
    { antes: { rotulo: /respons[aá]vel pelo projeto/i, nome: /^processo\./ }, html: titulo('Responsável pelo projeto', '(Contato principal)') },
    { antes: { rotulo: /representante/i }, html: titulo('Representante(s) legal(is)', '(responsável(is) pela assinatura)') },
    { antes: { rotulo: /testemunha/i }, html: titulo('Testemunha(s)') },
    { antes: { rotulo: /financeiro/i }, html: titulo('Responsável financeiro', '(recebimento de NFs)') },
    { antes: { rotulo: /^observa/i }, html:
        titulo('Informações gerais') +
        '<div class="fc-info">' +
          '<p>– Se ocorrer qualquer tipo de alteração cadastral, informe à Rubeus.</p>' +
          '<p>– As informações são de uso estritamente confidencial, protegidas pelos parâmetros da legislação vigente. ' +
          'Acesse a nossa <a href="https://rubeus.com.br/politica-de-privacidade/" target="_blank" rel="noopener">Política de Privacidade</a>.</p>' +
          '<p>– A responsabilidade pelo preenchimento é exclusiva do declarante.</p>' +
        '</div>' }
  ];

  var RODAPE =
    '<p class="fc-nota"><span class="fc-asterisco">1</span> A estrutura de atendimento da Rubeus é organizada pelo porte do cliente, ' +
    'assim, a informação sobre faturamento bruto anual é utilizada restrita e exclusivamente para melhor atender as necessidades de cada cliente.</p>' +
    '<div class="fc-rodape">' +
      '<div><span class="fc-ico">&#9742;</span><span>SP: (11) 3586-4784<br>BH: (31) 3514-7811</span></div>' +
      '<div><span class="fc-ico">@</span><span>contato@rubeus.com.br</span></div>' +
      '<div><span class="fc-ico">&#9906;</span><span>Praça João Pinheiro, 30<br>Centro, 36880-043 - Muriaé/MG</span></div>' +
    '</div>';

  function digitos(v) { return (v || '').replace(/\D/g, ''); }

  function formatar(tipo, v) {
    var d = digitos(v);
    switch (tipo) {
      case 'cpf':
        d = d.slice(0, 11);
        return d.replace(/^(\d{3})(\d)/, '$1.$2')
          .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
      case 'cnpj':
        d = d.slice(0, 14);
        return d.replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
      case 'cep':
        d = d.slice(0, 8);
        return d.replace(/^(\d{5})(\d)/, '$1-$2');
      case 'telefone':
        d = d.slice(0, 11);
        if (d.length <= 2) return d.length ? '(' + d : '';
        if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
        if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
        return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    }
    return v;
  }

  function cpfValido(c) {
    c = digitos(c);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== +c[t]) return false;
    }
    return true;
  }

  function cnpjValido(c) {
    c = digitos(c);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    var pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (var t = 12; t < 14; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +c[i] * pesos[i + 13 - t];
      var dv = s % 11 < 2 ? 0 : 11 - (s % 11);
      if (dv !== +c[t]) return false;
    }
    return true;
  }

  function chaveCampo(el) {
    var tipo = (el.type || '').toLowerCase();
    if ((tipo === 'radio' || tipo === 'checkbox') && el.name) return tipo + ':' + el.name;
    return el;
  }

  function camposDe(raiz) {
    return Array.prototype.filter.call(
      raiz.querySelectorAll('input, select, textarea'),
      function (el) { return IGNORAR.indexOf((el.type || '').toLowerCase()) === -1; }
    );
  }

  function contarCampos(no) {
    var chaves = [];
    camposDe(no).forEach(function (el) {
      var k = chaveCampo(el);
      if (chaves.indexOf(k) === -1) chaves.push(k);
    });
    return chaves.length;
  }

  function linhaDoCampo(el) {
    var atual = el;
    while (atual.parentElement && atual.parentElement !== document.body &&
           atual.parentElement.tagName !== 'FORM' && contarCampos(atual.parentElement) === 1) {
      atual = atual.parentElement;
    }
    return atual === el ? el.parentElement : atual;
  }

  function rotuloDaLinha(linha, el) {
    if (el.id) {
      var l = linha.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) return l;
    }
    var candidatos = linha.querySelectorAll('label, legend, span, p, div, strong');
    for (var i = 0; i < candidatos.length; i++) {
      var c = candidatos[i];
      if (c.contains(el) || camposDe(c).length) continue;
      if (c.textContent.trim()) return c;
    }
    return null;
  }

  function encurtarRotulo(rotulo) {
    var walker = document.createTreeWalker(rotulo, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      var partes = n.nodeValue.split(SEPARADOR);
      var texto = partes[partes.length - 1].replace(SUFIXO, '').replace(/(\S)\*/, '$1 *');
      if (texto !== n.nodeValue) {
        n.nodeValue = texto;
        return;
      }
    }
  }

  function ligarMascara(el, tipo) {
    if (el.dataset.fcMascara) return;
    el.dataset.fcMascara = tipo;
    if (tipo !== 'telefone' || el.type !== 'tel') el.setAttribute('inputmode', 'numeric');

    var aplicando = false;
    function aplicar() {
      if (aplicando) return;
      var novo = formatar(tipo, el.value);
      if (novo !== el.value) {
        el.value = novo;
        aplicando = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        aplicando = false;
      }
    }
    function validar() {
      var linha = el.closest('.fc-linha');
      var ok = true;
      if (el.value && tipo === 'cpf') ok = cpfValido(el.value);
      if (el.value && tipo === 'cnpj') ok = cnpjValido(el.value);
      el.setCustomValidity(ok ? '' : (tipo.toUpperCase() + ' inválido'));
      if (linha) linha.classList.toggle('fc-invalido', !ok);
    }
    el.addEventListener('input', aplicar);
    el.addEventListener('blur', validar);
    aplicar();
  }

  function processar() {
    document.documentElement.classList.add('fc-ficha');
    camposDe(document).forEach(function (el) {
      if (el.closest('.fc-linha') && el.dataset.fcOk) return;
      var linha = linhaDoCampo(el);
      if (!linha) return;
      linha.classList.add('fc-linha');
      linha.dataset.fcNome = el.name || '';
      linha.classList.add('fc-tipo-' + (el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || el.tagName).toLowerCase()));
      el.classList.add('fc-entrada');
      el.dataset.fcOk = '1';

      var rotulo = rotuloDaLinha(linha, el);
      if (!rotulo) return;
      rotulo.classList.add('fc-rotulo');
      if (!rotulo.dataset.fcOriginal) rotulo.dataset.fcOriginal = rotulo.textContent.trim();
      encurtarRotulo(rotulo);

      if (el.tagName === 'INPUT' && /^(text|tel|search|)$/.test(el.type)) {
        var original = rotulo.dataset.fcOriginal;
        for (var i = 0; i < MASCARAS.length; i++) {
          if (MASCARAS[i].teste.test(original)) { ligarMascara(el, MASCARAS[i].tipo); break; }
        }
      }
    });
    inserirBlocos();
  }

  function criarBloco(id, html) {
    var div = document.createElement('div');
    div.className = 'fc-bloco';
    div.setAttribute('data-fc-bloco', id);
    div.innerHTML = html;
    return div;
  }

  function inserirBlocos() {
    var linhas = document.querySelectorAll('.fc-linha');
    if (!linhas.length) return;
    BLOCOS.forEach(function (b, i) {
      if (document.querySelector('[data-fc-bloco="' + i + '"]')) return;
      var alvo = null;
      if (b.antes === 'primeiro') alvo = linhas[0];
      else {
        for (var j = 0; j < linhas.length && !alvo; j++) {
          var r = linhas[j].querySelector('.fc-rotulo');
          var txt = r ? (r.dataset.fcOriginal || '') : '';
          if ((b.antes.rotulo && b.antes.rotulo.test(txt)) ||
              (b.antes.nome && b.antes.nome.test(linhas[j].dataset.fcNome || ''))) alvo = linhas[j];
        }
      }
      if (alvo) alvo.parentNode.insertBefore(criarBloco(i, b.html), alvo);
    });
    if (!document.querySelector('[data-fc-bloco="rodape"]')) {
      var ultima = linhas[linhas.length - 1];
      var form = ultima.closest('form');
      var ref = form || ultima;
      ref.parentNode.insertBefore(criarBloco('rodape', RODAPE), ref.nextSibling);
    }
  }

  var agendado = null;
  function agendar() {
    if (agendado) return;
    agendado = setTimeout(function () { agendado = null; processar(); }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', processar);
  else processar();
  new MutationObserver(agendar).observe(document.documentElement, { childList: true, subtree: true });
})();
