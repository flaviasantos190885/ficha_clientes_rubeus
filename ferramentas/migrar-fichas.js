(function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '600',
    token: 'COLE_O_TOKEN_AQUI',
    eventoCriaFicha: 'COLE_O_TIPO_DE_EVENTO',
    processoFichas: '42',
    linkBase: 'https://rbacademy.apprbs.com.br/ficha_cadastral',
    campoLink: 'campopersonalizado_585_compl_proc',
    camposResponsavel: {
      nome: 'campopersonalizado_386_compl_proc',
      email: 'campopersonalizado_388_compl_proc',
      cpf: 'campopersonalizado_564_compl_proc',
      telefone: 'campopersonalizado_453_compl_proc'
    },
    camposCliente: {
      complemento: 'campopersonalizado_122_compl_cont',
      inscricaoEstadual: 'campopersonalizado_127_compl_cont',
      inscricaoMunicipal: 'campopersonalizado_126_compl_cont'
    },
    pausaMs: 400
  };

  var PAPEIS = [
    { titulo: 'Responsável pelo projeto', detalhe: '(Contato principal)', tipoFicha: '93', tiposGestao: ['93'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Representante(s) legal(is)', detalhe: '(responsável(is) pela assinatura)', tipoFicha: '82', tiposGestao: ['82'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Testemunha(s)', detalhe: '', tipoFicha: '2', tiposGestao: ['2'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Responsável financeiro', detalhe: '(recebimento de NFs)', tipoFicha: '78', tiposGestao: ['78', '89', '83'], campos: ['Nome', 'E-mail', 'Telefone'] }
  ];

  var CLIENTES = __CLIENTES__;

  var CHAVE = 'fc-migracao';

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  function api(metodo, corpo) {
    corpo = Object.assign({ origem: CONFIG.origem, token: CONFIG.token }, corpo);
    return fetch(CONFIG.api + metodo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); }).catch(function (e) { return { success: false, erro: String(e) }; });
  }

  function primeiro(lista) { return Array.isArray(lista) ? lista[0] : lista; }

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
    if (d.length !== 11) return v || '';
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  function telFormatado(v) {
    var d = digitos(v);
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return v || '';
  }

  async function dadosPessoa(id) {
    var r = await api('Contato/dadosPessoa', { id: id });
    return r && r.success ? primeiro(r.dados) : null;
  }

  async function compactar(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var fluxo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    var buf = new Uint8Array(await new Response(fluxo).arrayBuffer());
    var bin = '';
    for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return 'z.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function montarFicha(pj, porPapel) {
    var cidade = pj.cidade || pj.cidadeNome || '';
    var uf = pj.uf || pj.estado || '';
    if (cidade && typeof cidade === 'object') cidade = cidade.nome || '';
    var dados = [
      ['Nome', pj.nome || ''],
      ['CNPJ', cnpjFormatado(pj.cnpj || pj.codigo)],
      ['CEP', pj.cep || ''],
      ['Endereço sede completo', pj.endereco || pj.logradouro || ''],
      ['Número', pj.numero || ''],
      ['Complemento', pj.complemento || campoPers(pj, CONFIG.camposCliente.complemento)],
      ['Bairro', pj.bairro || ''],
      ['Inscrição Estadual', campoPers(pj, CONFIG.camposCliente.inscricaoEstadual)],
      ['Inscrição Municipal', campoPers(pj, CONFIG.camposCliente.inscricaoMunicipal)],
      ['Cidade/Estado', cidade && uf && String(cidade).indexOf(' - ') === -1 ? cidade + ' - ' + uf : (cidade || uf)],
      ['Faturamento bruto anual¹', ''],
      ['Regime de Tributação', '']
    ];
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
    var pj = await dadosPessoa(c.p);
    if (!pj) throw new Error('cliente ' + c.p + ' não encontrado');
    var vistos = {};
    var porPapel = PAPEIS.map(function () { return []; });
    for (var i = 0; i < c.r.length; i++) {
      var reg = await api('Registro/dados', { id: c.r[i] });
      var pessoas = reg && reg.success && reg.dados && Array.isArray(reg.dados.pessoas) ? reg.dados.pessoas : [];
      for (var j = 0; j < pessoas.length; j++) {
        var p = pessoas[j];
        var tipo = String(p.tipo || '');
        var idx = PAPEIS.findIndex(function (papel) { return papel.tiposGestao.indexOf(tipo) !== -1; });
        if (idx === -1 || String(p.id) === String(c.p) || vistos[idx + ':' + p.id]) continue;
        vistos[idx + ':' + p.id] = true;
        var d = await dadosPessoa(p.id);
        porPapel[idx].push({
          id: String(p.id),
          nome: (d && d.nome) || p.nome || '',
          email: emailDe(d),
          cpf: (d && (d.cpf || d.codigo)) || '',
          telefone: telefoneDe(d)
        });
        await esperar(CONFIG.pausaMs);
      }
    }
    var ficha = montarFicha(pj, porPapel);
    var link = CONFIG.linkBase + '?ficha=' + await compactar(ficha);
    var vinculos = [];
    var jaVinculado = {};
    porPapel.forEach(function (lista, i) {
      lista.forEach(function (p) {
        if (jaVinculado[p.id]) return;
        jaVinculado[p.id] = true;
        vinculos.push({ id: p.id, tipo: PAPEIS[i].tipoFicha });
      });
    });
    var resp = porPapel[0][0] || {};
    var campos = {};
    campos[CONFIG.campoLink] = link;
    if (resp.nome) campos[CONFIG.camposResponsavel.nome] = resp.nome;
    if (resp.email) campos[CONFIG.camposResponsavel.email] = resp.email;
    if (resp.cpf) campos[CONFIG.camposResponsavel.cpf] = cpfFormatado(resp.cpf);
    if (resp.telefone) campos[CONFIG.camposResponsavel.telefone] = digitos(resp.telefone);
    return { pj: pj, porPapel: porPapel, ficha: ficha, link: link, vinculos: vinculos, campos: campos };
  }

  async function criarRegistro(c, prep) {
    var cod = 'migracao_ficha_' + c.p + '_' + Date.now();
    var corpo = {
      tipo: CONFIG.eventoCriaFicha,
      pessoa: { id: c.p },
      codRegistro: cod,
      pessoasSecundarias: prep.vinculos,
      camposPersonalizados: prep.campos
    };
    var antes = await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas });
    var idsAntes = (antes && antes.success && Array.isArray(antes.dados) ? antes.dados : []).map(function (x) { return String(x.id); });
    var r = await api('Evento/cadastro', corpo);
    if (!r || r.success === false) throw new Error('Evento/cadastro recusado: ' + JSON.stringify(r).slice(0, 300));
    var registro = null;
    for (var t = 0; t < 20 && !registro; t++) {
      await esperar(1500);
      var l = await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas });
      var lista = l && l.success && Array.isArray(l.dados) ? l.dados : [];
      registro = lista.filter(function (x) { return x.codigoRegistro === cod; })[0] ||
        lista.filter(function (x) { return idsAntes.indexOf(String(x.id)) === -1; })
          .sort(function (a, b) { return Number(b.id) - Number(a.id); })[0] || null;
    }
    if (!registro) return { evento: r, registro: '' };
    var reg = await api('Registro/dados', { id: registro.id });
    var pessoas = reg && reg.success && reg.dados && Array.isArray(reg.dados.pessoas) ? reg.dados.pessoas : [];
    var faltando = prep.vinculos.filter(function (v) {
      return !pessoas.some(function (p) { return String(p.id) === v.id && String(p.tipo) === v.tipo; });
    });
    if (faltando.length) {
      var listaP = pessoas.map(function (p) { return { id: String(p.id), tipo: String(p.tipo || ''), principal: String(p.principal || '0') }; });
      prep.vinculos.forEach(function (v) {
        var e = listaP.filter(function (p) { return p.id === v.id; })[0];
        if (e) e.tipo = v.tipo; else listaP.push({ id: v.id, tipo: v.tipo, principal: '0' });
      });
      await api('Oportunidade/alterarPessoas', { id: registro.id, pessoas: listaP });
    }
    var linkGravado = reg && reg.dados && JSON.stringify(reg.dados).indexOf('ficha=z.') !== -1;
    return { evento: r, registro: String(registro.id), vinculosCorrigidos: faltando.length, linkGravado: linkGravado };
  }

  function lerProgresso() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; }
  }
  function salvarProgresso(p) {
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {}
  }

  function baixarRelatorio(linhas) {
    var cab = ['Cliente (id)', 'Nome', 'Situação', 'Registro criado', 'Pessoas vinculadas', 'Link gravado', 'Link da ficha', 'Detalhe'];
    var csv = [cab].concat(linhas).map(function (l) {
      return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'migracao-fichas-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv';
    a.click();
  }

  window.fichaMigrar = async function (opcoes) {
    opcoes = opcoes || {};
    var teste = opcoes.teste !== false;
    var limite = opcoes.limite || (teste ? 3 : CLIENTES.length);
    if (!teste && (CONFIG.token.indexOf('COLE_') === 0 || CONFIG.eventoCriaFicha.indexOf('COLE_') === 0)) {
      console.error('Configure o token e o tipo de evento (eventoCriaFicha) antes de rodar sem teste.');
      return;
    }
    var progresso = lerProgresso();
    var relatorio = [];
    var feitos = 0;
    var lista = opcoes.clientes ? CLIENTES.filter(function (c) { return opcoes.clientes.indexOf(c.p) !== -1; }) : CLIENTES;
    console.log((teste ? '[TESTE - nada será criado] ' : '') + 'Clientes na lista: ' + lista.length + ' | limite desta rodada: ' + limite);
    for (var i = 0; i < lista.length && feitos < limite; i++) {
      var c = lista[i];
      if (!teste && progresso[c.p] && progresso[c.p].registro) continue;
      feitos++;
      try {
        var prep = await prepararCliente(c);
        var resumo = prep.porPapel.map(function (l, k) { return PAPEIS[k].titulo + ': ' + l.map(function (p) { return p.nome + ' <' + (p.email || 'sem e-mail') + '>'; }).join(', '); }).join(' | ');
        if (teste) {
          console.log('#' + feitos, prep.pj.nome, '\n  ' + resumo, '\n  vínculos:', prep.vinculos, '\n  campos:', prep.campos, '\n  dados do cliente (para conferir os nomes das propriedades):', prep.pj);
          relatorio.push([c.p, prep.pj.nome, 'teste', '', prep.vinculos.length, '', prep.link, resumo]);
        } else {
          var res = await criarRegistro(c, prep);
          progresso[c.p] = { registro: res.registro, quando: new Date().toISOString() };
          salvarProgresso(progresso);
          console.log('#' + feitos, prep.pj.nome, '-> registro', res.registro || '(não encontrado)', '| vínculos corrigidos:', res.vinculosCorrigidos, '| link gravado:', res.linkGravado);
          relatorio.push([c.p, prep.pj.nome, res.registro ? 'criado' : 'evento aceito, registro não encontrado', res.registro, prep.vinculos.length, res.linkGravado ? 'sim' : 'conferir', prep.link, resumo]);
        }
      } catch (e) {
        console.warn('#' + feitos, 'cliente', c.p, 'erro:', e.message);
        relatorio.push([c.p, '', 'erro', '', '', '', '', e.message]);
      }
      await esperar(CONFIG.pausaMs);
    }
    baixarRelatorio(relatorio);
    console.log('Fim. Relatório baixado (' + relatorio.length + ' linhas).');
  };

  window.fichaMigracaoZerar = function () { localStorage.removeItem(CHAVE); console.log('Progresso apagado.'); };

  console.log('Script de migração carregado. Teste: fichaMigrar()  |  Real: fichaMigrar({ teste: false, limite: 2 })');
})();
