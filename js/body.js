/*
 * Ficha Cadastral Rubeus — Javascript em Body
 * -------------------------------------------
 * Não move nem recria campos do Rubeus (para não quebrar o envio do form).
 * Ele apenas:
 *   1. marca cada campo com classes próprias (fc-linha / fc-rotulo / fc-entrada)
 *      para o CSS desenhar o layout "tabela" da ficha;
 *   2. encurta o rótulo exibido: "Responsável pelo projeto - Nome" vira "Nome"
 *      (o nome completo continua no Rubeus, só muda o texto na tela);
 *   3. aplica máscara em CPF, CNPJ, telefone e CEP (detectados pelo rótulo)
 *      e avisa quando CPF/CNPJ é inválido.
 * Roda de novo sozinho se o Rubeus redesenhar o formulário.
 */
(function () {
  'use strict';

  var SEPARADOR = /\s+[-–—|]\s+/;          // "Seção - Campo"
  var IGNORAR = ['hidden', 'submit', 'button', 'reset', 'image'];

  var MASCARAS = [
    { teste: /\bcnpj\b/i, tipo: 'cnpj' },
    { teste: /\bcpf\b/i, tipo: 'cpf' },
    { teste: /\bcep\b/i, tipo: 'cep' },
    { teste: /telefone|celular|whats/i, tipo: 'telefone' }
  ];

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

  // Quantos campos "distintos" existem dentro do nó (radios do mesmo grupo contam 1)
  function contarCampos(no) {
    var chaves = [];
    camposDe(no).forEach(function (el) {
      var k = chaveCampo(el);
      if (chaves.indexOf(k) === -1) chaves.push(k);
    });
    return chaves.length;
  }

  // Sobe a partir do campo até o maior ancestral que contém só ele
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
      if (partes.length > 1) {
        n.nodeValue = partes[partes.length - 1];
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
        // avisa o framework do Rubeus que o valor mudou
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
