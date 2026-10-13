(function () {
  // Favorito "Conferir gestão x distribuição":
  // lê a lista de Contatos aberta no Rubeus (coluna Nome e coluna RpR - Responsável comercial) e compara
  // com a planilha de distribuição (a planilha manda). Não usa API nem token: só lê a tela.
  var CHAVE_LINK = 'fc-conferir-gestao-link';
  var ID_PAINEL = 'fc-conferir-gestao';
  // cadastros de teste da gestão: não entram na conferência
  var IGNORAR_NA_GESTAO = ['rubeus para rubeus', 'contato modelo projetos'];

  var antigo = document.getElementById(ID_PAINEL);
  if (antigo) antigo.remove();

  // ---------- utilidades ----------
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ler(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

  // chaves de comparação de um nome: nome inteiro e cada pedaço separado por "/" (a gestão junta apelidos)
  function chaves(nome) {
    var lista = [nome].concat(String(nome).split('/'));
    var out = [];
    lista.forEach(function (x) {
      var n = norm(x);
      if (n.length < 2) return;
      [n, n.replace(/ /g, '')].forEach(function (k) { if (out.indexOf(k) === -1) out.push(k); });
    });
    return out;
  }

  // ---------- planilha ----------
  function lerCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    var primeira = texto.split('\n')[0] || '';
    var sep = [',', ';', '\t'].map(function (s) { return [s, primeira.split(s).length]; })
      .sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var linhas = [], linha = [], campo = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  // acha as colunas "cliente" e "executivo" mesmo se a planilha mudar de lugar
  function lerPlanilha(linhas) {
    var cab = -1, colExec = -1, colNome = 0;
    for (var i = 0; i < Math.min(linhas.length, 15) && cab < 0; i++) {
      for (var j = 0; j < linhas[i].length; j++) {
        if (/executiv/i.test(linhas[i][j])) { cab = i; colExec = j; break; }
      }
    }
    if (cab < 0) {
      for (var i2 = 0; i2 < Math.min(linhas.length, 15) && cab < 0; i2++) {
        for (var j2 = 0; j2 < linhas[i2].length; j2++) {
          if (/respons|representante|rpr/i.test(linhas[i2][j2])) { cab = i2; colExec = j2; break; }
        }
      }
    }
    if (cab < 0) { cab = 0; colExec = 1; }
    for (var k = 0; k < linhas[cab].length; k++) {
      if (k !== colExec && /nome|cliente/i.test(linhas[cab][k])) { colNome = k; break; }
    }
    var itens = [];
    for (var r = cab + 1; r < linhas.length; r++) {
      var nome = (linhas[r][colNome] || '').trim();
      if (!nome) continue;
      itens.push({ nome: nome, exec: (linhas[r][colExec] || '').trim(), linha: r + 1 });
    }
    return { itens: itens, cabecalhoNome: linhas[cab][colNome] || '', cabecalhoExec: linhas[cab][colExec] || '' };
  }

  async function buscarPlanilha(link) {
    link = link.trim();
    var urls = [];
    var id = (link.match(/\/spreadsheets\/d\/([\w-]+)/) || [])[1];
    var gid = (link.match(/[#?&]gid=(\d+)/) || [])[1] || '0';
    if (/\/spreadsheets\/d\/e\//.test(link)) {
      urls.push(link.replace(/\/pubhtml/, '/pub').replace(/output=\w+/, 'output=csv'));
    } else if (id) {
      urls.push('https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&gid=' + gid);
      urls.push('https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv&gid=' + gid);
    } else if (/^https?:/.test(link)) urls.push(link);
    else throw new Error('Link da planilha inválido.');
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i], { credentials: 'omit' });
        var t = await r.text();
        if (r.ok && !/^\s*<(!doctype|html)/i.test(t)) return t;
      } catch (e) {}
    }
    var e = new Error('Não consegui ler a planilha pelo link (o Google bloqueia quando ela não é pública).');
    e.urlCsv = id ? 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=csv&gid=' + gid : '';
    throw e;
  }

  // ---------- leitura da tela do Rubeus ----------
  function nosDeTexto() {
    var out = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      var el = n.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
      var rg = document.createRange();
      rg.selectNodeContents(n);
      var r = rg.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      out.push({ t: t, el: el, l: r.left, cy: (r.top + r.bottom) / 2, bottom: r.bottom });
    }
    return out;
  }

  function celulaDe(no, outro) {
    var el = no.el;
    while (el.parentElement && !el.parentElement.contains(outro.el) && el.parentElement !== document.body &&
      el.parentElement.getBoundingClientRect().height < 90) el = el.parentElement;
    var r = el.getBoundingClientRect();
    return { el: el, left: r.left, right: r.right, bottom: r.bottom };
  }

  function acharCabecalho(nos) {
    var nomes = nos.filter(function (n) { return /^nome(\s|\W)?\S?$/i.test(n.t); });
    var resps = nos.filter(function (n) { return /^rpr\s*-\s*respons/i.test(n.t) || /representante comercial/i.test(n.t); });
    for (var i = 0; i < nomes.length; i++) {
      for (var j = 0; j < resps.length; j++) {
        if (Math.abs(nomes[i].cy - resps[j].cy) < 12 && resps[j].l > nomes[i].l) {
          var cn = celulaDe(nomes[i], resps[j]), cr = celulaDe(resps[j], nomes[i]);
          return { nome: cn, resp: cr, bottom: Math.max(cn.bottom, cr.bottom), cy: nomes[i].cy };
        }
      }
    }
    return null;
  }

  function rolagemDe(nos, cab) {
    var cand = nos.filter(function (n) { return n.cy > cab.bottom && n.l >= cab.nome.left - 2 && n.l < cab.nome.right; })[0];
    var el = cand && cand.el;
    while (el && el !== document.body && el !== document.documentElement) {
      var cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function linhasVisiveis(cab, rolagem, exigirId) {
    var ehDoc = rolagem === document.scrollingElement || rolagem === document.documentElement;
    var topo = cab.bottom;
    if (cab.nome.el.isConnected) {
      var rb = cab.nome.el.getBoundingClientRect();
      if (rb.bottom > 0 && rb.bottom <= window.innerHeight) topo = rb.bottom; else topo = 0;
    } else topo = 0;
    var nos = nosDeTexto().filter(function (n) {
      return n.cy > topo && (ehDoc || rolagem.contains(n.el));
    }).sort(function (a, b) { return a.cy - b.cy; });
    var grupos = [], atual = null;
    nos.forEach(function (n) {
      if (!atual || n.cy - atual.fim > 10) { atual = { fim: n.cy, nos: [] }; grupos.push(atual); }
      atual.nos.push(n); atual.fim = n.cy;
    });
    var out = [];
    grupos.forEach(function (g) {
      var nome = g.nos.filter(function (n) { return n.l >= cab.nome.left - 2 && n.l < cab.nome.right; })
        .sort(function (a, b) { return a.l - b.l; }).map(function (n) { return n.t; }).join(' ').trim();
      var exec = g.nos.filter(function (n) { return n.l >= cab.resp.left - 2 && n.l < cab.resp.right; })
        .sort(function (a, b) { return a.l - b.l; }).map(function (n) { return n.t; }).join(' ').trim();
      var idNo = g.nos.filter(function (n) { return /^\d{5,}$/.test(n.t); })[0];
      if (!nome || /^nome(\s|\W)?\S?$/i.test(nome)) return;
      if (exigirId && !idNo) return;
      if (!norm(exec)) exec = '';
      out.push({ nome: nome, exec: exec, id: idNo ? idNo.t : '' });
    });
    return out;
  }

  async function lerGestao(avisar) {
    var nos = nosDeTexto();
    var cab = acharCabecalho(nos);
    if (!cab) throw new Error('Não achei as colunas "Nome" e "RpR - Responsável..." na tela. Abra Contatos com essas colunas visíveis (visão "Gestão de clientes - Executivo") e tente de novo.');
    var totalNo = nos.filter(function (n) { return /^\d+\s+contatos?$/i.test(n.t); })[0];
    var total = totalNo ? parseInt(totalNo.t, 10) : 0;
    var rolagem = rolagemDe(nos, cab);
    var ehDoc = rolagem === document.scrollingElement || rolagem === document.documentElement;
    var alturaVis = ehDoc ? window.innerHeight : rolagem.clientHeight;
    var topoIni = rolagem.scrollTop, esqIni = rolagem.scrollLeft;
    var mapa = {}, qtd = 0, exigirId = false;

    function varrer() {
      linhasVisiveis(cab, rolagem, exigirId).forEach(function (l) {
        var k = l.id || norm(l.nome);
        if (!mapa[k]) qtd++;
        mapa[k] = l;
      });
    }
    rolagem.scrollTop = 0;
    await esperar(400);
    varrer();
    if (Object.keys(mapa).some(function (k) { return mapa[k].id; })) {
      exigirId = true; mapa = {}; qtd = 0; varrer();
    }
    for (var passo = 0; passo < 400; passo++) {
      avisar('Lendo a lista do Rubeus... ' + qtd + (total ? ' de ' + total : ''));
      if (total && qtd >= total) break;
      var antes = rolagem.scrollTop, alturaAntes = rolagem.scrollHeight;
      rolagem.scrollTop = antes + alturaVis * 0.8;
      await esperar(350);
      varrer();
      if (rolagem.scrollTop === antes) {
        await esperar(900); varrer();
        if (rolagem.scrollHeight === alturaAntes) break;
      }
    }
    rolagem.scrollTop = topoIni; rolagem.scrollLeft = esqIni;
    return { linhas: Object.keys(mapa).map(function (k) { return mapa[k]; }), total: total };
  }

  function distancia(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
  }

  // nota de semelhança entre dois nomes já normalizados (0 = nada a ver):
  // 3 = um nome inteiro está dentro do outro (AFYA em "AFYA EDUCACIONAL")
  // 2 = abreviação (SENAI AL em "SENAI ALAGOAS")
  // 1 = erro de digitação (Tecnoparque / Tecnopark)
  function similar(a, b) {
    var ta = a.split(' '), tb = b.split(' ');
    var ehA = ta.length !== tb.length ? ta.length < tb.length : a.length <= b.length;
    var curto = ehA ? ta : tb, longo = ehA ? tb : ta;
    if (a === b || curto.join('').length < 3) return 0;
    var melhor = 0;
    for (var i = 0; i + curto.length <= longo.length; i++) {
      var inteiro = true, abrev = true, junto = '';
      for (var j = 0; j < curto.length; j++) {
        var x = curto[j], y = longo[i + j];
        if (x !== y) inteiro = false;
        var ultimo = j === curto.length - 1;
        if (!(x === y || (ultimo && curto.length > 1 && x.length >= 2 && y.indexOf(x) === 0))) abrev = false;
        junto += y;
      }
      if (inteiro) melhor = Math.max(melhor, 3);
      else if (abrev) melhor = Math.max(melhor, 2);
      else {
        var c = curto.join('');
        if (c.length >= 8 && 1 - distancia(c, junto) / Math.max(c.length, junto.length) >= 0.7) melhor = Math.max(melhor, 1);
      }
    }
    return melhor;
  }

  // ---------- comparação (a planilha manda) ----------
  function comparar(gestao, planilha) {
    var porChave = {};
    planilha.forEach(function (p) {
      p.chaves = chaves(p.nome); p.achados = [];
      p.chaves.forEach(function (k) { (porChave[k] = porChave[k] || []).push(p); });
    });
    var certos = [], divergentes = [], aproximados = [], soGestao = [];
    var restantes = [];
    gestao.forEach(function (g) {
      var ks = chaves(g.nome), cand = [];
      ks.forEach(function (k) { (porChave[k] || []).forEach(function (p) { if (cand.indexOf(p) === -1) cand.push(p); }); });
      if (!cand.length) { restantes.push({ g: g, ks: ks }); return; }
      var p = cand.filter(function (x) { return norm(x.exec) === norm(g.exec); })[0] || cand[0];
      p.achados.push(g);
      (norm(p.exec) === norm(g.exec) ? certos : divergentes).push({ g: g, p: p });
    });
    // casamento aproximado entre os que sobraram (a gestão e a planilha escrevem o nome de formas diferentes)
    restantes.forEach(function (r) {
      var melhor = null, nota = 0;
      planilha.forEach(function (p) {
        r.ks.forEach(function (a) {
          p.chaves.forEach(function (b) {
            var n = similar(a, b);
            if (n > nota) { nota = n; melhor = p; }
          });
        });
      });
      if (melhor) { melhor.achados.push(r.g); aproximados.push({ g: r.g, p: melhor }); }
      else soGestao.push(r.g);
    });
    var faltando = planilha.filter(function (p) { return !p.achados.length; });
    return { certos: certos, divergentes: divergentes, aproximados: aproximados, soGestao: soGestao, faltando: faltando };
  }

  // ---------- tela ----------
  var host = document.createElement('div');
  host.id = ID_PAINEL;
  host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;';
  var sombra = host.attachShadow({ mode: 'open' });
  sombra.innerHTML =
    '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}' +
    '.caixa{width:620px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#222;border:1px solid #bbb;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.35);padding:14px;font-size:13px}' +
    '.topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}' +
    '.topo b{font-size:15px}' +
    'button{cursor:pointer;border:1px solid #0e8f7e;background:#0e8f7e;color:#fff;border-radius:5px;padding:7px 12px;font-size:13px}' +
    'button.sec{background:#fff;color:#0e8f7e}button.x{background:none;border:0;color:#666;font-size:18px;padding:0 4px}' +
    'input[type=text]{width:100%;padding:7px;border:1px solid #bbb;border-radius:5px;font-size:13px;margin:4px 0 8px}' +
    'label{font-weight:bold;font-size:12px}.linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}' +
    '.msg{margin:8px 0;padding:8px;border-radius:5px;background:#f2f2f2}.erro{background:#fde8e8;color:#8a1c1c}' +
    '.badges{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.b{padding:5px 9px;border-radius:12px;font-weight:bold;font-size:12px}' +
    '.ok{background:#e2f5e9;color:#17653a}.dv{background:#fff1d6;color:#8a5a00}.fa{background:#fde8e8;color:#8a1c1c}.sg{background:#e6edff;color:#24408e}.ap{background:#eee;color:#444}' +
    'h4{margin:14px 0 4px;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}' +
    'th,td{border-bottom:1px solid #e4e4e4;text-align:left;padding:4px 6px;vertical-align:top}th{background:#f6f6f6}' +
    '.peq{color:#666;font-size:11px}details{margin-top:6px}' +
    '</style><div class="caixa"></div>';
  var caixa = sombra.querySelector('.caixa');

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') e.textContent = attrs[k];
      else if (k === 'onclick') e.onclick = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }

  var campoLink = el('input', { type: 'text', placeholder: 'Cole aqui o link da planilha (a aba certa)', value: ler(CHAVE_LINK) });
  var campoArquivo = el('input', { type: 'file', accept: '.csv,text/csv,text/plain' });
  var areaMsg = el('div');
  var areaRes = el('div');
  var ultimoCsv = '';

  function msg(texto, erro) {
    areaMsg.innerHTML = '';
    if (texto) areaMsg.appendChild(el('div', { class: 'msg' + (erro ? ' erro' : ''), texto: texto }));
  }

  function tabela(cols, linhas) {
    var t = el('table');
    t.appendChild(el('thead', {}, [el('tr', {}, cols.map(function (c) { return el('th', { texto: c }); }))]));
    var tb = el('tbody');
    linhas.forEach(function (l) { tb.appendChild(el('tr', {}, l.map(function (c) { return el('td', { texto: c }); }))); });
    t.appendChild(tb);
    return t;
  }
  function secao(titulo, dica, cols, linhas, aberta) {
    if (!linhas.length) return el('div');
    var d = el('details', aberta ? { open: '' } : {}, [el('summary', { texto: titulo + ' (' + linhas.length + ')' })]);
    if (dica) d.appendChild(el('div', { class: 'peq', texto: dica }));
    d.appendChild(tabela(cols, linhas));
    return d;
  }

  function mostrar(res, info) {
    areaRes.innerHTML = '';
    var tudoCerto = !res.divergentes.length && !res.faltando.length && !res.soGestao.length;
    areaRes.appendChild(el('div', { class: 'badges' }, [
      el('span', { class: 'b ok', texto: '✔ Certos: ' + res.certos.length }),
      el('span', { class: 'b dv', texto: '⚠ Divergentes: ' + res.divergentes.length }),
      el('span', { class: 'b fa', texto: '✖ Faltando na gestão: ' + res.faltando.length }),
      el('span', { class: 'b sg', texto: '? Só na gestão: ' + res.soGestao.length }),
      el('span', { class: 'b ap', texto: '≈ Nome aproximado: ' + res.aproximados.length })
    ]));
    areaRes.appendChild(el('div', { class: 'peq', texto:
      'Gestão: ' + info.gestao + ' contatos lidos' + (info.totalTela ? ' (a tela diz ' + info.totalTela + ')' : '') + (info.ignorados ? ', ' + info.ignorados + ' de teste ignorados' : '') +
      ' · Planilha: ' + info.planilha + ' clientes (colunas "' + info.cabNome + '" e "' + info.cabExec + '")' }));
    if (info.totalTela && info.totalTela !== info.gestao) {
      areaRes.appendChild(el('div', { class: 'msg erro', texto: 'Atenção: li ' + info.gestao + ' contatos mas a tela mostra ' + info.totalTela + '. Confira o resultado com cuidado.' }));
    }
    if (tudoCerto) areaRes.appendChild(el('div', { class: 'msg', texto: res.aproximados.length ? 'Tudo certo, exceto os nomes aproximados abaixo para você confirmar.' : 'Tudo certo! A gestão está igual à planilha de distribuição.' }));
    areaRes.appendChild(secao('⚠ Divergência de executivo', 'A planilha é a que vale: troque na gestão para o "Deveria ser".',
      ['Cliente (gestão)', 'Está na gestão', 'Deveria ser (planilha)'],
      res.divergentes.map(function (x) { return [x.g.nome, x.g.exec || '(vazio)', x.p.exec || '(vazio)']; }), true));
    areaRes.appendChild(secao('✖ Está na planilha e não está na gestão', 'Cliente da planilha que não apareceu na lista de contatos.',
      ['Cliente (planilha)', 'Executivo (planilha)'],
      res.faltando.map(function (p) { return [p.nome, p.exec]; }), true));
    areaRes.appendChild(secao('? Está na gestão e não está na planilha', 'Cliente com executivo na gestão que a planilha não tem.',
      ['Cliente (gestão)', 'Executivo (gestão)'],
      res.soGestao.map(function (g) { return [g.nome, g.exec || '(vazio)']; }), true));
    areaRes.appendChild(secao('≈ Nome aproximado (confirme se é o mesmo cliente)', 'O nome não é igual (abreviação, parte do nome ou erro de digitação). Veja se é o mesmo cliente.',
      ['Cliente (gestão)', 'Executivo (gestão)', 'Cliente (planilha)', 'Executivo (planilha)', 'Executivo'],
      res.aproximados.map(function (x) { return [x.g.nome, x.g.exec || '(vazio)', x.p.nome, x.p.exec || '(vazio)', norm(x.g.exec) === norm(x.p.exec) ? '✔ confere' : '⚠ DIFERENTE']; }), true));
    areaRes.appendChild(secao('✔ Certos', '', ['Cliente (gestão)', 'Executivo'],
      res.certos.map(function (x) { return [x.g.nome, x.g.exec]; }), false));

    var linhasCsv = [['Situação', 'Cliente (gestão)', 'Executivo (gestão)', 'Cliente (planilha)', 'Executivo (planilha)']];
    res.divergentes.forEach(function (x) { linhasCsv.push(['Divergente', x.g.nome, x.g.exec, x.p.nome, x.p.exec]); });
    res.faltando.forEach(function (p) { linhasCsv.push(['Falta na gestão', '', '', p.nome, p.exec]); });
    res.soGestao.forEach(function (g) { linhasCsv.push(['Só na gestão', g.nome, g.exec, '', '']); });
    res.aproximados.forEach(function (x) { linhasCsv.push(['Nome aproximado', x.g.nome, x.g.exec, x.p.nome, x.p.exec]); });
    res.certos.forEach(function (x) { linhasCsv.push(['Certo', x.g.nome, x.g.exec, x.p.nome, x.p.exec]); });
    ultimoCsv = linhasCsv.map(function (l) {
      return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    areaRes.appendChild(el('div', { class: 'linha', style: 'margin-top:12px' }, [
      el('button', { class: 'sec', texto: 'Baixar resultado (CSV)', onclick: function () {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + ultimoCsv], { type: 'text/csv;charset=utf-8' }));
        a.download = 'conferencia-gestao-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv';
        a.click();
      } })
    ]));
  }

  var emAndamento = false;
  async function conferir(csvTexto) {
    if (emAndamento) return;
    emAndamento = true;
    areaRes.innerHTML = '';
    try {
      if (csvTexto == null) {
        if (!campoLink.value.trim()) throw new Error('Cole o link da planilha.');
        guardar(CHAVE_LINK, campoLink.value.trim());
        msg('Lendo a planilha...');
        try { csvTexto = await buscarPlanilha(campoLink.value); }
        catch (e) {
          if (e.urlCsv) {
            areaMsg.innerHTML = '';
            areaMsg.appendChild(el('div', { class: 'msg erro' }, [
              e.message + ' Baixe a aba como CSV ',
              el('a', { href: e.urlCsv, target: '_blank', texto: '(clique aqui para baixar)' }),
              ' e escolha o arquivo no campo "Ou escolha o CSV" abaixo.'
            ]));
            return;
          }
          throw e;
        }
      }
      var pl = lerPlanilha(lerCSV(csvTexto));
      if (!pl.itens.length) throw new Error('A planilha não tem linhas com cliente.');
      var g = await lerGestao(msg);
      var lidos = g.linhas.length;
      g.linhas = g.linhas.filter(function (x) { return IGNORAR_NA_GESTAO.indexOf(norm(x.nome)) === -1; });
      msg('');
      mostrar(comparar(g.linhas, pl.itens), {
        gestao: lidos, ignorados: lidos - g.linhas.length, totalTela: g.total, planilha: pl.itens.length,
        cabNome: pl.cabecalhoNome, cabExec: pl.cabecalhoExec
      });
    } catch (e) {
      msg(e.message || String(e), true);
    } finally { emAndamento = false; }
  }

  campoArquivo.onchange = function () {
    var f = campoArquivo.files[0];
    if (!f) return;
    var leitor = new FileReader();
    leitor.onload = function () { conferir(String(leitor.result)); };
    leitor.readAsText(f);
  };

  caixa.appendChild(el('div', { class: 'topo' }, [
    el('b', { texto: 'Conferir gestão x planilha de distribuição' }),
    el('button', { class: 'x', texto: '✕', title: 'Fechar', onclick: function () { host.remove(); } })
  ]));
  caixa.appendChild(el('label', { texto: 'Link da planilha (fica salvo para a próxima vez)' }));
  caixa.appendChild(campoLink);
  caixa.appendChild(el('div', { class: 'linha' }, [el('button', { texto: 'Conferir', onclick: function () { conferir(null); } })]));
  caixa.appendChild(el('details', {}, [
    el('summary', { texto: 'Ou escolha o CSV (se o link não abrir)' }),
    el('div', { class: 'linha', style: 'margin-top:6px' }, [campoArquivo])
  ]));
  caixa.appendChild(areaMsg);
  caixa.appendChild(areaRes);
  document.body.appendChild(host);
})();
