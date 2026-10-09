(function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '903',
    token: 'COLE_O_TOKEN_AQUI',
    eventoAtualizaLink: '',
    processoFichas: '42',
    linkBase: 'https://rbacademy.apprbs.com.br/ficha_cadastral',
    campoLink: 'campopersonalizado_585_compl_proc',
    pausaMs: 300
  };

  var PAPEIS = [
    { titulo: 'Responsável pelo projeto', detalhe: '(Contato principal)', tipo: '93', campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Representante(s) legal(is)', detalhe: '(responsável(is) pela assinatura)', tipo: '82', campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Testemunha(s)', detalhe: '', tipo: '2', campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Responsável financeiro', detalhe: '(recebimento de NFs)', tipo: '78', campos: ['Nome', 'E-mail', 'Telefone'] }
  ];

  var CLIENTES = __CLIENTES__;
  var EMPRESAS = __EMPRESAS__;

  var CHAVE = 'fc-atualizar-links';

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  function api(metodo, corpo) {
    corpo = Object.assign({ origem: CONFIG.origem, token: CONFIG.token }, corpo);
    var ctrl = new AbortController();
    var limite = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(CONFIG.api + metodo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: ctrl.signal
    }).then(function (r) { return r.text(); }).then(function (t) {
      try { return JSON.parse(t); } catch (e) { return { success: false, erro: 'resposta não é JSON', texto: t.slice(0, 300) }; }
    }).catch(function (e) { return { success: false, erro: String(e) }; })
      .finally(function () { clearTimeout(limite); });
  }

  function primeiro(v) { return Array.isArray(v) ? v[0] : v; }
  function listaDe(r) { return r && r.success && Array.isArray(r.dados) ? r.dados : []; }

  function emailDe(p) {
    if (!p) return '';
    var e = p.emails;
    if (e && e.principal) return e.principal.email || e.principal || '';
    if (Array.isArray(e) && e.length) {
      var x = e.filter(function (i) { return String(i.principal) === '1'; })[0] || e[0];
      return x.email || '';
    }
    return p.emailPrincipal || p.email || '';
  }

  function telefoneDe(p) {
    if (!p) return '';
    var t = p.telefones;
    if (t && t.principal) return t.principal.numero || t.principal.telefone || t.principal || '';
    if (Array.isArray(t) && t.length) {
      var x = t.filter(function (i) { return String(i.principal) === '1'; })[0] || t[0];
      return x.telefone || x.numero || '';
    }
    return p.telefonePrincipal || p.telefone || '';
  }

  function campoPers(p, nome) {
    var c = (p && p.camposPersonalizados) || {};
    var v = c[nome];
    if (Array.isArray(v)) v = v[0];
    if (v && typeof v === 'object') v = v.valor || v.value || '';
    return v ? String(v) : '';
  }

  function cnpjFormatado(v) {
    var d = digitos(v);
    if (!d) return '';
    d = d.padStart(14, '0');
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  }
  function cpfFormatado(v) {
    var d = digitos(v);
    return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : (v || '');
  }
  function telFormatado(v) {
    var d = digitos(v);
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return v || '';
  }
  function cepFormatado(v) {
    var d = digitos(v);
    return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : (v || '');
  }

  async function compactar(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    var buf = new Uint8Array(await new Response(fluxo).arrayBuffer());
    var bin = '';
    for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return 'z.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function dadosPessoa(id) {
    var r = await api('Contato/dadosPessoa', { id: id });
    return r && r.success ? primeiro(r.dados) : null;
  }

  async function pessoasDoRegistro(id) {
    var r = await api('Registro/dados', { id: id });
    return r && r.success && r.dados ? { pessoas: Array.isArray(r.dados.pessoas) ? r.dados.pessoas : [], bruto: r.dados } : null;
  }

  function montarFicha(pj, empresa, cidadeUf, porPapel) {
    empresa = empresa || {};
    var cidade = pj.cidadeNome || (typeof pj.cidade === 'string' && /\D/.test(pj.cidade) ? pj.cidade : '');
    var uf = pj.uf || pj.estado || '';
    var temEndereco = pj.endereco || pj.logradouro;
    var dados = [
      ['Nome', empresa.nome || pj.nome || ''],
      ['CNPJ', cnpjFormatado(pj.cnpj || pj.codigo || empresa.cnpj)]
    ];
    if (empresa.razao) dados.push(['Razão social', empresa.razao]);
    dados = dados.concat([
      ['CEP', cepFormatado(pj.cep || empresa.cep)],
      ['Endereço sede completo', temEndereco ? (pj.endereco || pj.logradouro) : (empresa.endereco || '')],
      ['Número', temEndereco ? (pj.numero || '') : ''],
      ['Complemento', temEndereco ? (pj.complemento || campoPers(pj, 'campopersonalizado_122_compl_cont')) : ''],
      ['Bairro', temEndereco ? (pj.bairro || '') : ''],
      ['Inscrição Estadual', empresa.ie || campoPers(pj, 'campopersonalizado_127_compl_cont')],
      ['Inscrição Municipal', empresa.im || campoPers(pj, 'campopersonalizado_126_compl_cont')],
      ['Cidade/Estado', cidadeUf || (cidade && uf ? cidade + ' - ' + uf : (cidade || uf))],
      ['Faturamento bruto anual¹', empresa.faturamento || ''],
      ['Regime de Tributação', empresa.regime || '']
    ]);
    var secoes = [['Dados cadastrais do cliente', dados, '']];
    PAPEIS.forEach(function (papel, i) {
      var pessoas = porPapel[i].length ? porPapel[i] : [{}];
      var linhas = [];
      pessoas.forEach(function (p, n) {
        var suf = n ? ' (' + (n + 1) + 'º)' : '';
        papel.campos.forEach(function (c) {
          var v = c === 'Nome' ? p.nome : c === 'E-mail' ? p.email : c === 'CPF' ? cpfFormatado(p.cpf) : telFormatado(p.telefone);
          linhas.push([c + suf, v || '']);
        });
      });
      secoes.push([papel.titulo, linhas, papel.detalhe]);
    });
    secoes.push(['Informações gerais', [['Observação', '']], '']);
    return { v: 1, o: 'importacao', t: new Date().toISOString(), s: secoes };
  }

  async function prepararCliente(c) {
    var fichas = listaDe(await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas })).map(function (x) { return String(x.id); });
    if (!fichas.length) return { fichas: [] };
    var pj = await dadosPessoa(c.p);
    if (!pj) throw new Error('cliente não encontrado');
    var reg = await pessoasDoRegistro(fichas[0]);
    if (!reg) throw new Error('não consegui ler o registro ' + fichas[0]);
    var cache = {};
    var porPapel = PAPEIS.map(function () { return []; });
    for (var i = 0; i < reg.pessoas.length; i++) {
      var p = reg.pessoas[i];
      var idx = PAPEIS.findIndex(function (papel) { return papel.tipo === String(p.tipo); });
      if (idx === -1 || String(p.id) === String(c.p)) continue;
      if (porPapel[idx].some(function (x) { return x.id === String(p.id); })) continue;
      if (!cache[p.id]) { cache[p.id] = await dadosPessoa(p.id) || {}; await esperar(CONFIG.pausaMs); }
      var d = cache[p.id];
      porPapel[idx].push({ id: String(p.id), nome: d.nome || p.nome || '', email: emailDe(d), cpf: d.cpf || '', telefone: telefoneDe(d) });
    }
    var ficha = montarFicha(pj, EMPRESAS[c.p], c.c, porPapel);
    var link = CONFIG.linkBase + '?ficha=' + await compactar(ficha);
    return { fichas: fichas, pj: pj, porPapel: porPapel, link: link, registroBruto: reg.bruto };
  }

  function linkGravado(bruto, link) {
    var codigo = link.split('ficha=')[1];
    return JSON.stringify(bruto || {}).indexOf(codigo.slice(0, 60)) !== -1;
  }

  async function gravarLink(c, prep) {
    var resultados = [];
    for (var i = 0; i < prep.fichas.length; i++) {
      var campos = {};
      campos[CONFIG.campoLink] = prep.link;
      var r = await api('Evento/cadastro', {
        tipo: CONFIG.eventoAtualizaLink,
        pessoa: { id: c.p },
        idOportunidade: prep.fichas[i],
        camposPersonalizados: campos
      });
      if (!r || r.success === false) { resultados.push(prep.fichas[i] + ': evento recusado ' + JSON.stringify(r).slice(0, 150)); continue; }
      var ok = false;
      for (var t = 0; t < 8 && !ok; t++) {
        await esperar(1500);
        var reg = await pessoasDoRegistro(prep.fichas[i]);
        ok = reg && linkGravado(reg.bruto, prep.link);
      }
      resultados.push(prep.fichas[i] + ': ' + (ok ? 'link atualizado' : 'evento aceito, mas o link ainda não aparece no registro'));
    }
    return resultados;
  }

  function lerProgresso() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; } }
  function salvarProgresso(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {} }

  function baixar(nome, linhas) {
    var cab = ['ID do cliente', 'Cliente', 'Registro em Fichas', 'Pessoas na ficha', 'Usou ficha original', 'Situação', 'Link novo'];
    var csv = [cab].concat(linhas).map(function (l) {
      return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    a.click();
  }

  window.fichaVerLink = async function (idCliente) {
    idCliente = String(idCliente);
    var c = CLIENTES.filter(function (x) { return x.p === idCliente; })[0] || { p: idCliente };
    var prep = await prepararCliente(c);
    if (!prep.fichas.length) { console.warn('Cliente sem registro em Fichas.'); return; }
    console.log(prep.pj.nome + ' | registro ' + prep.fichas.join(', ') + ' | ficha original: ' + (EMPRESAS[c.p] ? EMPRESAS[c.p].arquivo : 'não tem'));
    console.log(prep.link);
    window.open(prep.link, '_blank');
    return prep.link;
  };

  window.fichaAtualizarLinks = async function (opcoes) {
    opcoes = opcoes || {};
    var teste = opcoes.teste !== false;
    if (CONFIG.token.indexOf('COLE_') === 0) { console.error('Token não configurado.'); return; }
    if (!teste && !CONFIG.eventoAtualizaLink) { console.error('Falta o tipo de evento que atualiza o registro (eventoAtualizaLink).'); return; }
    var lista = opcoes.clientes ? CLIENTES.filter(function (c) { return opcoes.clientes.map(String).indexOf(c.p) !== -1; }) : CLIENTES;
    var limite = opcoes.limite || lista.length;
    var progresso = lerProgresso();
    var relatorio = [], pendentes = [], feitos = 0;
    console.log((teste ? '[TESTE - nada será gravado] ' : '') + 'Clientes: ' + lista.length + ' | limite: ' + limite);
    for (var i = 0; i < lista.length && feitos < limite; i++) {
      var c = lista[i];
      if (!teste && progresso[c.p] && !(opcoes.refazer && opcoes.refazer.map(String).indexOf(c.p) !== -1)) continue;
      feitos++;
      try {
        var prep = await prepararCliente(c);
        if (!prep.fichas.length) { console.log('#' + feitos + ' cliente ' + c.p + ': sem registro em Fichas'); relatorio.push([c.p, '', '', '', '', 'sem registro em Fichas', '']); continue; }
        var qtd = prep.porPapel.map(function (l, k) { return PAPEIS[k].tipo + ':' + l.length; }).join(' ');
        var original = EMPRESAS[c.p] ? 'sim (' + EMPRESAS[c.p].data + ')' : 'não';
        if (teste) {
          console.log('#' + feitos + ' ' + prep.pj.nome + ' | registro ' + prep.fichas.join(', ') + ' | pessoas ' + qtd + ' | ficha original: ' + original);
          relatorio.push([c.p, prep.pj.nome, prep.fichas.join(', '), qtd, original, 'teste', prep.link]);
        } else {
          var res = await gravarLink(c, prep);
          var ok = res.every(function (x) { return / link atualizado$/.test(x); });
          if (ok) { progresso[c.p] = new Date().toISOString(); salvarProgresso(progresso); } else pendentes.push(c.p);
          console.log('#' + feitos + ' ' + prep.pj.nome + ' -> ' + res.join(' || '));
          relatorio.push([c.p, prep.pj.nome, prep.fichas.join(', '), qtd, original, res.join(' || '), prep.link]);
        }
      } catch (e) {
        pendentes.push(c.p);
        console.warn('#' + feitos + ' cliente ' + c.p + ': erro ' + e.message);
        relatorio.push([c.p, '', '', '', '', 'erro: ' + e.message, '']);
      }
      await esperar(CONFIG.pausaMs);
    }
    console.log('Fim.' + (pendentes.length ? ' Com problema: ' + pendentes.length + '. Para refazer: fichaAtualizarLinks({ teste: false, clientes: ' + JSON.stringify(pendentes) + ', refazer: ' + JSON.stringify(pendentes) + ' })' : ''));
    if (relatorio.length) baixar('links-fichas-' + (teste ? 'teste-' : '') + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv', relatorio);
  };

  window.fichaAtualizarLinksZerar = function () { localStorage.removeItem(CHAVE); console.log('Progresso apagado.'); };

  console.log('Script carregado (' + CLIENTES.length + ' clientes, ' + Object.keys(EMPRESAS).length + ' com ficha original). Ver um: fichaVerLink(\'ID_DO_CLIENTE\')  |  Teste: fichaAtualizarLinks({ limite: 5 })');
})();
