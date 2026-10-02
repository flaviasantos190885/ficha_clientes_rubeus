(function () {
  'use strict';

  var LOGO = 'https://raw.githubusercontent.com/flaviasantos190885/ficha_clientes_rubeus/claude/sleepy-euler-p7poiw/img/logo-rubeus.png';
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
          '<img class="fc-logo-img" src="' + LOGO + '" alt="Rubeus">' +
          '<a class="fc-site" href="https://rubeus.com.br" target="_blank" rel="noopener">rubeus.com.br</a>' +
        '</div>' +
        '<h1 class="fc-titulo-ficha">Ficha cadastral</h1>' +
        '<p class="fc-subtitulo-ficha">Preencha os dados abaixo para a formalização do contrato.</p>' +
        titulo('Dados cadastrais do cliente') },
    { antes: { rotulo: /respons[aá]vel pelo projeto/i, nome: /campopersonalizado_386_/ }, html: titulo('Responsável pelo projeto', '(Contato principal)') },
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
      if (aplicando || el.dataset.fcSemMascara) return;
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
      for (var p = el.parentElement; p && p !== linha; p = p.parentElement) p.classList.add('fc-cel');
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
    configurarCep();
    ajustarBandeira();
    configurarLink();
    configurarEnvio();
  }

  function ajustarBandeira() {
    document.querySelectorAll('.fc-linha .fc-entrada[data-fc-mascara="telefone"]').forEach(function (el) {
      var linha = el.closest('.fc-linha');
      for (var n = el; n && n !== linha; n = n.parentElement) {
        Array.prototype.forEach.call(n.parentElement.children, function (irmao) {
          if (irmao === n || irmao.classList.contains('fc-rotulo') || irmao.contains(el)) return;
          if (/error|erro|invalid|fc-aviso/i.test(irmao.className)) return;
          var pareceBandeira = /flag|country|iti|vti|dropdown|select|pais|ddi/i.test(String(irmao.className)) ||
            irmao.querySelector('img, svg, [class*="flag"]') || /^\s*\+?\d{0,3}\s*$/.test(irmao.textContent) && irmao.textContent.trim();
          if (pareceBandeira) {
            irmao.classList.add('fc-bandeira');
            el.dataset.fcSemMascara = '1';
            var largura = irmao.getBoundingClientRect().width;
            if (largura > 0 && largura < 200) el.style.setProperty('padding-left', Math.round(largura + 10) + 'px', 'important');
          }
        });
        if (n.parentElement === linha) break;
      }
    });
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
    var caixa = linhas[0].closest('form') || linhas[0].parentNode;
    caixa.classList.add('fc-container');
    if (caixa.parentElement && caixa.parentElement !== document.body) caixa.parentElement.classList.add('fc-container-pai');
    if (!document.querySelector('[data-fc-bloco="rodape"]')) caixa.appendChild(criarBloco('rodape', RODAPE));
  }

  var ENDERECO = {
    cep: 'pessoa.cep',
    rua: 'pessoa.endereco',
    numero: 'pessoa.numero',
    complemento: 'contato.camposPersonalizados.campopersonalizado_122_compl_cont',
    bairro: 'pessoa.bairro',
    cidade: 'pessoa.cidade'
  };
  var OCULTAR_ATE_CEP = ['rua', 'numero', 'complemento', 'bairro', 'cidade'];

  function campoPorNome(n) { return document.querySelector('[name="' + n + '"]'); }

  function definirValor(el, v) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function normalizar(t) {
    return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function opcaoDaCidade(cidade, uf, campo) {
    var nc = normalizar(cidade), nu = normalizar(uf);
    var ops = document.querySelectorAll('li, [role="option"], .dropdown-item, a, div, span');
    var melhor = null;
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      if (!o.offsetParent || o === campo || o.contains(campo) || o.closest('.fc-bloco')) continue;
      var t = normalizar(o.textContent);
      if (!t || t.length > nc.length + 12 || t.indexOf(nc) !== 0) continue;
      if (t !== nc && !new RegExp('(^|[^a-z])' + nu + '([^a-z]|$)').test(t.slice(nc.length))) continue;
      if (!melhor || melhor.contains(o)) melhor = o;
    }
    return melhor;
  }

  function clicar(o) {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (t) {
      o.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    });
    o.click();
  }

  function escolherOpcao(campo, cidade, uf, tentativas, fim) {
    var o = opcaoDaCidade(cidade, uf, campo);
    if (o) { clicar(o); fim(true); return; }
    if (tentativas > 0) setTimeout(function () { escolherOpcao(campo, cidade, uf, tentativas - 1, fim); }, 300);
    else fim(false);
  }

  function digitar(campo, texto, pronto) {
    var i = 0;
    definirValor(campo, '');
    (function proximo() {
      if (i >= texto.length) { pronto(); return; }
      var c = texto.charAt(i++);
      campo.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: c }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(campo, campo.value + c);
      campo.dispatchEvent(new InputEvent('input', { bubbles: true, data: c, inputType: 'insertText' }));
      campo.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: c }));
      setTimeout(proximo, 25);
    })();
  }

  function tecla(el, tipo) {
    el.dispatchEvent(new KeyboardEvent(tipo, { bubbles: true, key: 'a', keyCode: 65 }));
  }

  function validarCampo(el) {
    el.focus();
    tecla(el, 'keyup');
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function itemDaLista(campo, cidade, uf) {
    var alvo = normalizar(cidade + ' - ' + uf);
    var lista = document.getElementById(campo.getAttribute('data-target') || '') || campo.parentElement;
    var itens = lista ? lista.querySelectorAll('li') : [];
    for (var i = 0; i < itens.length; i++) {
      if (normalizar(itens[i].textContent) === alvo) return itens[i];
    }
    return null;
  }

  function selecionarNaLista(campo, li, d) {
    var inst = window.M && M.Autocomplete && M.Autocomplete.getInstance && M.Autocomplete.getInstance(campo);
    if (inst && typeof inst.selectOption === 'function') {
      if (!li) {
        li = document.createElement('li');
        li.innerHTML = '<span></span>';
        li.firstChild.textContent = d.localidade + ' - ' + d.uf;
      }
      var envolver = window.cash || window.jQuery;
      inst.selectOption(envolver ? envolver(li) : li);
      return true;
    }
    if (li) { clicar(li.querySelector('span') || li); return true; }
    return false;
  }

  function preencherCidade(campo, d, depois) {
    travar(campo, false);
    campo.focus();
    var idAntes = campo.getAttribute('valueid');
    digitar(campo, d.localidade, function () {
      var tentativas = 10;
      (function tentar() {
        var li = itemDaLista(campo, d.localidade, d.uf);
        if (!li && tentativas-- > 0) { setTimeout(tentar, 250); return; }
        var ok = selecionarNaLista(campo, li, d);
        setTimeout(function () {
          campo.blur();
          setTimeout(function () {
            var aceito = ok && normalizar(campo.value) === normalizar(d.localidade + ' - ' + d.uf) && !/invalid/i.test(campo.className);
            console.log('[ficha] cidade:', campo.value, '| valueid:', idAntes, '->', campo.getAttribute('valueid'), '| aceita:', aceito);
            if (aceito) {
              travar(campo, true);
              depois();
            } else {
              campo.focus();
              avisoCep('Selecione a cidade na lista do campo Cidade/Estado.');
            }
          }, 200);
        }, 150);
      })();
    });
  }

  function mostrarEndereco(mostrar) {
    OCULTAR_ATE_CEP.forEach(function (k) {
      var el = campoPorNome(ENDERECO[k]);
      var linha = el && el.closest('.fc-linha');
      if (linha) linha.classList.toggle('fc-oculto', !mostrar);
    });
  }

  function avisoCep(texto) {
    var cep = campoPorNome(ENDERECO.cep);
    var linha = cep && cep.closest('.fc-linha');
    if (!linha) return;
    var aviso = linha.querySelector('.fc-aviso');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'fc-aviso';
      linha.appendChild(aviso);
    }
    aviso.textContent = texto || '';
    aviso.style.display = texto ? '' : 'none';
  }

  function travar(el, sim) {
    var linha = el.closest('.fc-linha');
    el.tabIndex = sim ? -1 : 0;
    if (linha) linha.classList.toggle('fc-travado', sim);
  }

  function buscarCep(cep) {
    avisoCep('Buscando endereço...');
    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        mostrarEndereco(true);
        var cid = campoPorNome(ENDERECO.cidade);
        if (cid) travar(cid, false);
        if (!d || d.erro) { avisoCep('CEP não encontrado. Preencha o endereço manualmente.'); return; }
        avisoCep('');
        var rua = campoPorNome(ENDERECO.rua);
        var bairro = campoPorNome(ENDERECO.bairro);
        var cidade = campoPorNome(ENDERECO.cidade);
        var numero = campoPorNome(ENDERECO.numero);
        if (rua && d.logradouro) { definirValor(rua, d.logradouro); validarCampo(rua); }
        if (bairro && d.bairro) { definirValor(bairro, d.bairro); validarCampo(bairro); }
        var focarNumero = function () { if (numero) setTimeout(function () { numero.focus(); }, 50); };
        if (cidade && d.localidade) preencherCidade(cidade, d, focarNumero);
        else focarNumero();
      })
      .catch(function () {
        mostrarEndereco(true);
        avisoCep('Não foi possível buscar o CEP. Preencha o endereço manualmente.');
      });
  }

  function configurarCep() {
    var cep = campoPorNome(ENDERECO.cep);
    if (!cep || !cep.closest('.fc-linha') || cep.dataset.fcCep) return;
    cep.dataset.fcCep = '1';
    var jaPreenchido = OCULTAR_ATE_CEP.some(function (k) {
      var el = campoPorNome(ENDERECO[k]);
      return el && el.value;
    });
    mostrarEndereco(jaPreenchido || digitos(cep.value).length === 8);
    var ultimo = '';
    function verificar() {
      var d = digitos(cep.value);
      if (d.length === 8 && d !== ultimo) { ultimo = d; buscarCep(d); }
    }
    cep.addEventListener('input', verificar);
    cep.addEventListener('change', verificar);
    cep.addEventListener('blur', function () {
      if (digitos(cep.value).length && digitos(cep.value).length < 8) mostrarEndereco(true);
    });
  }

  var LINK_CAMPO = 'processo.camposPersonalizados.campopersonalizado_585_compl_proc';
  var LINK_BASE = 'https://flaviasantos190885.github.io/ficha_clientes_rubeus/ficha/';

  function valorDoCampo(linha) {
    var sel = linha.querySelector('select.fc-entrada');
    if (sel) {
      var op = sel.options[sel.selectedIndex];
      return op && op.value !== '' && !/^selecione/i.test(op.text) ? op.text.trim() : '';
    }
    var marcados = linha.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
    if (linha.querySelector('input[type="checkbox"], input[type="radio"]')) {
      return Array.prototype.map.call(marcados, function (m) {
        var l = m.closest('label');
        return l ? l.textContent.trim() : (m.value || 'Sim');
      }).join(', ');
    }
    var el = linha.querySelector('.fc-entrada');
    return el ? el.value.trim() : '';
  }

  function montarDados() {
    var secoes = [];
    var atual = null;
    document.querySelectorAll('.fc-bloco .fc-secao, .fc-linha').forEach(function (n) {
      if (n.classList.contains('fc-secao')) {
        atual = [n.childNodes[0].textContent.trim(), [], (n.querySelector('small') || {}).textContent || ''];
        secoes.push(atual);
        return;
      }
      if (n.dataset.fcNome === LINK_CAMPO) return;
      var rot = n.querySelector('.fc-rotulo');
      if (!rot) return;
      if (!atual) { atual = ['', [], '']; secoes.push(atual); }
      atual[1].push([rot.textContent.replace(/\s*\*\s*$/, '').trim(), valorDoCampo(n)]);
    });
    return { v: 1, t: new Date().toISOString(), s: secoes.filter(function (x) { return x[1].length; }) };
  }

  function base64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function compactar(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'undefined') return Promise.resolve('d=' + base64url(bytes));
    var fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(fluxo).arrayBuffer().then(function (buf) { return 'z=' + base64url(new Uint8Array(buf)); });
  }

  function atualizarLink() {
    var campo = campoPorNome(LINK_CAMPO);
    if (!campo) return Promise.resolve();
    return compactar(montarDados()).then(function (parte) {
      var link = LINK_BASE + '#' + parte;
      if (campo.value !== link) definirValor(campo, link);
    }).catch(function () {});
  }

  var agendaLink = null;
  function configurarLink() {
    var campo = campoPorNome(LINK_CAMPO);
    if (!campo) return;
    var linha = campo.closest('.fc-linha');
    if (linha) linha.classList.add('fc-oculto-sempre');
    if (document.documentElement.dataset.fcLink) return;
    document.documentElement.dataset.fcLink = '1';
    function agendar() {
      clearTimeout(agendaLink);
      agendaLink = setTimeout(atualizarLink, 300);
    }
    document.addEventListener('input', function (e) { if (e.target.name !== LINK_CAMPO) agendar(); }, true);
    document.addEventListener('change', function (e) { if (e.target.name !== LINK_CAMPO) agendar(); }, true);
    agendar();
  }

  var RUBEUS = {
    url: 'https://crmrbacademy.apprubeus.com.br/',
    urlFicha: 'https://rbacademy.apprbs.com.br/',
    origem: '600',
    token: 'COLE_O_TOKEN_AQUI'
  };

  var VINCULO = {
    tipoPessoa: '93',
    eventoVinculo: '3550',
    processo: '',
    baseLegal: '4',
    assinaturas: ['3', '5'],
    campoCnpjContato: 'campopersonalizado_96_compl_cont',
    empresaNome: 'pessoa.nome',
    empresaCnpj: 'pessoa.cnpj',
    nome: 'processo.camposPersonalizados.campopersonalizado_386_compl_proc',
    email: 'processo.camposPersonalizados.campopersonalizado_388_compl_proc',
    cpf: 'processo.camposPersonalizados.campopersonalizado_564_compl_proc',
    telefone: 'processo.camposPersonalizados.campopersonalizado_453_compl_proc'
  };

  if (typeof window.iniciar !== 'function') {
    window.iniciar = function () {
      if (window.RBLib && RBLib.config) {
        RBLib.config({ urlBase: RUBEUS.url, urlFicha: RUBEUS.urlFicha, token: RUBEUS.token, origem: RUBEUS.origem });
      }
    };
  }

  var cadastro = { cod: novoCodigo(), pj: '', pf: '', emAndamento: false, liberar: false };

  function novoCodigo() {
    return Date.now() + '' + Math.floor(Math.random() * 10000) + '_rpr_ficha';
  }

  function valorPorNome(n) {
    var el = campoPorNome(n);
    return el ? String(el.value || '').trim() : '';
  }

  function esperar(ms) {
    return new Promise(function (ok) { setTimeout(ok, ms); });
  }

  function api(metodo, corpo) {
    corpo.origem = RUBEUS.origem;
    corpo.token = RUBEUS.token;
    return fetch(RUBEUS.url + 'api/' + metodo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); });
  }

  function idDaResposta(r) {
    if (!r || r.success === false || !r.dados) return '';
    var d = Array.isArray(r.dados) ? r.dados[0] : r.dados;
    return d && typeof d === 'object' ? String(d.id || '') : String(d);
  }

  function formForm() {
    var c = document.querySelector('#rbFormContainer');
    return (c && c.querySelector('form')) || document.querySelector('form');
  }

  function campoOculto(nome) {
    var el = campoPorNome(nome);
    if (!el) {
      el = document.createElement('input');
      el.name = nome;
      el.style.display = 'none';
      formForm().appendChild(el);
    }
    return el;
  }

  function aviso(msg, tipo) {
    var c = document.getElementById('fc-status');
    if (!c) {
      c = document.createElement('div');
      c.id = 'fc-status';
      c.className = 'fc-status';
      document.body.appendChild(c);
    }
    c.className = 'fc-status fc-status-' + (tipo || 'info');
    c.textContent = msg;
    c.style.display = msg ? '' : 'none';
    if (tipo && tipo !== 'info') setTimeout(function () { c.style.display = 'none'; }, 8000);
  }

  async function obterPJ() {
    if (cadastro.pj) return cadastro.pj;
    var cnpj = digitos(valorPorNome(VINCULO.empresaCnpj));
    var codigos = cnpj ? [cnpj, formatar('cnpj', cnpj)] : [];
    for (var i = 0; i < codigos.length; i++) {
      var r = await api('Contato/dadosPessoa', { codigo: codigos[i] }).catch(function () { return null; });
      var id = idDaResposta(r);
      if (id) { console.log('[ficha] cliente encontrado pelo CNPJ:', id); return (cadastro.pj = id); }
    }
    var corpo = {
      nome: valorPorNome(VINCULO.empresaNome),
      naturezaJuridica: 2,
      baseLegal: VINCULO.baseLegal,
      assinaturas: VINCULO.assinaturas.map(function (a) { return { id: a }; })
    };
    var email = valorPorNome(VINCULO.email);
    var tel = digitos(valorPorNome(VINCULO.telefone));
    if (email) corpo.emailPrincipal = email;
    if (tel) corpo.telefonePrincipal = tel;
    if (cnpj) {
      corpo.codigo = cnpj;
      corpo.camposPersonalizados = {};
      corpo.camposPersonalizados[VINCULO.campoCnpjContato] = cnpj;
    }
    var resp = await api('Contato/cadastro', corpo);
    console.log('[ficha] cadastro do cliente (PJ):', resp);
    var novo = idDaResposta(resp);
    if (!novo) throw new Error('não foi possível cadastrar o cliente');
    return (cadastro.pj = novo);
  }

  async function obterPF() {
    if (cadastro.pf) return cadastro.pf;
    var nome = valorPorNome(VINCULO.nome);
    if (!nome) throw new Error('nome do responsável vazio');
    var corpo = {
      nome: nome,
      naturezaJuridica: 1,
      baseLegal: VINCULO.baseLegal,
      assinaturas: VINCULO.assinaturas.map(function (a) { return { id: a }; })
    };
    var email = valorPorNome(VINCULO.email);
    var tel = digitos(valorPorNome(VINCULO.telefone));
    var cpf = digitos(valorPorNome(VINCULO.cpf));
    if (email) corpo.emailPrincipal = email;
    if (tel) corpo.telefonePrincipal = tel;
    if (cpf) corpo.cpf = cpf;
    var resp = await api('Contato/cadastro', corpo);
    console.log('[ficha] cadastro do responsável (PF):', resp);
    var id = idDaResposta(resp);
    if (!id) throw new Error('não foi possível cadastrar o responsável');
    if (id === cadastro.pj) throw new Error('o responsável caiu no mesmo contato do cliente (mesmo e-mail/telefone)');
    return (cadastro.pf = id);
  }

  async function aguardarRegistro() {
    var inicio = Date.now();
    while (Date.now() - inicio < 60000) {
      var corpo = { id: cadastro.pj };
      if (VINCULO.processo) corpo.processo = VINCULO.processo;
      var r = await api('Contato/listarOportunidades', corpo).catch(function () { return null; });
      var lista = r && r.success && Array.isArray(r.dados) ? r.dados : [];
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].codigoRegistro === cadastro.cod) return lista[i];
      }
      await esperar(2000);
    }
    throw new Error('o registro não apareceu no CRM a tempo');
  }

  async function vincular(registro) {
    var corpo = {
      tipo: VINCULO.eventoVinculo,
      pessoa: { id: cadastro.pj },
      codRegistro: cadastro.cod,
      pessoasSecundarias: [{ id: cadastro.pf, tipo: VINCULO.tipoPessoa }]
    };
    if (registro && registro.id) corpo.idOportunidade = registro.id;
    for (var t = 1; t <= 10; t++) {
      var r = await api('Evento/cadastro', JSON.parse(JSON.stringify(corpo))).catch(function () { return null; });
      console.log('[ficha] vínculo, tentativa ' + t + ':', r);
      if (r && r.success !== false) return r;
      await esperar(2000);
    }
    throw new Error('falha no vínculo após 10 tentativas');
  }

  function envioConcluido() {
    var f = document.getElementById('rbFormFeedbackMessage');
    return !!(f && f.offsetParent !== null);
  }

  function barradoNaValidacao() {
    return Array.prototype.some.call(document.querySelectorAll('.invalidField'), function (el) { return el.offsetParent !== null; });
  }

  async function envioNativo(btn) {
    if (typeof btn.ondblclick === 'function') btn.ondblclick.call(btn, new MouseEvent('dblclick'));
    else { cadastro.liberar = true; btn.click(); }
    var inicio = Date.now();
    while (Date.now() - inicio < 30000) {
      await esperar(300);
      if (envioConcluido()) return true;
      if (Date.now() - inicio > 1200 && barradoNaValidacao()) return false;
    }
    return true;
  }

  async function finalizar(btn) {
    await atualizarLink().catch(function () {});
    var comVinculo = RUBEUS.token !== 'COLE_O_TOKEN_AQUI' && !!valorPorNome(VINCULO.nome);
    if (comVinculo) {
      aviso('Cadastrando cliente e responsável pelo projeto...');
      try {
        await obterPJ();
        await obterPF();
        campoOculto('contato.id').value = cadastro.pj;
        campoOculto('evento.codRegistro').value = cadastro.cod;
      } catch (e) {
        console.warn('[ficha] seguindo sem vínculo:', e);
        comVinculo = false;
      }
    } else {
      console.warn('[ficha] vínculo desligado (token não configurado ou responsável vazio)');
    }
    aviso(comVinculo ? 'Enviando a ficha...' : '');
    var ok = await envioNativo(btn);
    if (!ok) { aviso(''); return; }
    if (!comVinculo) { aviso(''); return; }
    try {
      aviso('Aguardando o registro ser criado no CRM...');
      var registro = await aguardarRegistro();
      aviso('Vinculando o responsável pelo projeto...');
      await vincular(registro);
      aviso('Ficha enviada e responsável pelo projeto vinculado!', 'sucesso');
    } catch (e) {
      console.error('[ficha] erro no vínculo:', e);
      aviso('Ficha enviada, mas não foi possível vincular o responsável. Vincule manualmente.', 'erro');
    }
  }

  function configurarEnvio() {
    if (document.documentElement.dataset.fcEnvio) return;
    document.documentElement.dataset.fcEnvio = '1';
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('#rbBtnNext');
      if (!btn) return;
      if (cadastro.liberar) { cadastro.liberar = false; return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cadastro.emAndamento || btn.disabled) return;
      cadastro.emAndamento = true;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.6';
      finalizar(btn).catch(function (err) { console.error('[ficha]', err); }).then(function () {
        cadastro.emAndamento = false;
        btn.style.pointerEvents = '';
        btn.style.opacity = '';
      });
    }, true);
    document.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('#rbBtnNext')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.rbReturnToFirstStep')) {
        cadastro = { cod: novoCodigo(), pj: '', pf: '', emAndamento: false, liberar: false };
      }
    }, true);
  }

  var agendado = null;
  function agendar() {
    if (agendado) return;
    agendado = setTimeout(function () { agendado = null; processar(); }, 50);
  }

  setTimeout(ajustarBandeira, 1500);
  setTimeout(ajustarBandeira, 4000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', processar);
  else processar();
  new MutationObserver(agendar).observe(document.documentElement, { childList: true, subtree: true });
})();
