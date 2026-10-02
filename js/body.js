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

  function preencherCidade(campo, d, depois) {
    travar(campo, false);
    campo.focus();
    digitar(campo, d.localidade, function () {
      escolherOpcao(campo, d.localidade, d.uf, 12, function (ok) {
        setTimeout(function () {
          var aceito = ok && campo.value && !/invalid/i.test(campo.className);
          if (aceito) {
            travar(campo, true);
            depois();
          } else {
            console.log('[ficha] cidade não selecionada automaticamente:', d.localidade, d.uf);
            campo.focus();
            avisoCep('Selecione a cidade na lista do campo Cidade/Estado.');
          }
        }, 400);
      });
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
    if (!campo) return;
    compactar(montarDados()).then(function (parte) {
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
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '600',
    token: 'COLE_O_TOKEN_AQUI'
  };

  var VINCULO = {
    tipo: '93',
    nome: 'processo.camposPersonalizados.campopersonalizado_386_compl_proc',
    email: 'processo.camposPersonalizados.campopersonalizado_388_compl_proc',
    cpf: 'processo.camposPersonalizados.campopersonalizado_564_compl_proc',
    telefone: 'processo.camposPersonalizados.campopersonalizado_453_compl_proc'
  };

  function valorPorNome(n) {
    var el = campoPorNome(n);
    return el ? String(el.value || '').trim() : '';
  }

  function chamarApi(metodo, corpo) {
    corpo.origem = RUBEUS.origem;
    corpo.token = RUBEUS.token;
    return fetchOriginal(RUBEUS.api + metodo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); });
  }

  function cadastrarResponsavel() {
    var nome = valorPorNome(VINCULO.nome);
    var email = valorPorNome(VINCULO.email);
    var tel = digitos(valorPorNome(VINCULO.telefone));
    var cpf = digitos(valorPorNome(VINCULO.cpf));
    if (!nome || (!email && !tel)) return Promise.reject('responsável sem nome/e-mail/telefone');
    var corpo = { nome: nome };
    if (email) corpo.emailPrincipal = email;
    if (tel) corpo.telefonePrincipal = tel;
    if (cpf) corpo.cpf = cpf;
    return chamarApi('Contato/cadastro', corpo).then(function (d) {
      console.log('[ficha] Contato/cadastro do responsável:', d);
      if (!d || !d.success || !d.dados) throw d;
      return [{ id: String(d.dados), tipo: VINCULO.tipo }];
    });
  }

  function comTempoLimite(promessa, ms) {
    return Promise.race([promessa, new Promise(function (_, nao) { setTimeout(function () { nao('tempo esgotado'); }, ms); })]);
  }

  function ehEnvioDoForm(url, corpo) {
    if (typeof corpo !== 'string' || corpo.charAt(0) !== '{') return false;
    if (String(url).indexOf(RUBEUS.api) === 0) return false;
    try {
      var j = JSON.parse(corpo);
      return !!(j && j.pessoa && typeof j.pessoa === 'object');
    } catch (e) { return false; }
  }

  function injetar(corpo, secundarias) {
    var j = JSON.parse(corpo);
    j.pessoasSecundarias = (Array.isArray(j.pessoasSecundarias) ? j.pessoasSecundarias : []).concat(secundarias);
    return JSON.stringify(j);
  }

  function prepararCorpo(url, corpo) {
    console.log('[ficha] envio do formulário detectado:', url, corpo);
    return comTempoLimite(cadastrarResponsavel(), 8000).then(function (sec) {
      var novo = injetar(corpo, sec);
      console.log('[ficha] envio com responsável vinculado (tipo ' + VINCULO.tipo + '):', novo);
      return novo;
    }, function (erro) {
      console.warn('[ficha] não foi possível vincular o responsável, enviando sem vínculo:', erro);
      return corpo;
    });
  }

  var fetchNativo = window.fetch;
  function fetchOriginal(entrada, opcoes) { return fetchNativo.call(window, entrada, opcoes); }
  if (!window.__fcInterceptado && typeof Proxy !== 'undefined') {
    window.__fcInterceptado = true;
    var proto = XMLHttpRequest.prototype;
    proto.open = new Proxy(proto.open, {
      apply: function (alvo, xhr, args) {
        try { xhr.__fcUrl = args[1]; } catch (e) {}
        return Reflect.apply(alvo, xhr, args);
      }
    });
    proto.send = new Proxy(proto.send, {
      apply: function (alvo, xhr, args) {
        var corpo = args[0];
        if (typeof corpo === 'string') console.log('[ficha] requisição:', xhr.__fcUrl, corpo.slice(0, 300));
        if (!ehEnvioDoForm(xhr.__fcUrl, corpo)) return Reflect.apply(alvo, xhr, args);
        prepararCorpo(xhr.__fcUrl, corpo).then(function (novo) { Reflect.apply(alvo, xhr, [novo]); });
      }
    });
    window.fetch = new Proxy(fetchNativo, {
      apply: function (alvo, ctx, args) {
        var entrada = args[0], opcoes = args[1];
        var url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
        if (opcoes && typeof opcoes.body === 'string') console.log('[ficha] requisição:', url, opcoes.body.slice(0, 300));
        if (opcoes && ehEnvioDoForm(url, opcoes.body)) {
          return prepararCorpo(url, opcoes.body).then(function (novo) {
            return Reflect.apply(alvo, window, [entrada, Object.assign({}, opcoes, { body: novo })]);
          });
        }
        return Reflect.apply(alvo, window, args);
      }
    });
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
