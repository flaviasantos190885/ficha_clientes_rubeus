(function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '600',
    token: 'COLE_O_TOKEN_AQUI',
    eventoCriaFicha: 'COLE_O_TIPO_DE_EVENTO',
    eventoOrigem: '903',
    eventoToken: 'COLE_O_TOKEN_DO_EVENTO',
    processoFichas: '42',
    processoGestao: '76',
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
    { titulo: 'Responsável pelo projeto', detalhe: '(Contato principal)', tiposGestao: ['93'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Representante(s) legal(is)', detalhe: '(responsável(is) pela assinatura)', tiposGestao: ['82'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Testemunha(s)', detalhe: '', tiposGestao: ['2'], campos: ['Nome', 'E-mail', 'CPF', 'Telefone'] },
    { titulo: 'Responsável financeiro', detalhe: '(recebimento de NFs)', tiposGestao: ['78'], campos: ['Nome', 'E-mail', 'Telefone'] }
  ];

  var CLIENTES = __CLIENTES__;

  var CHAVE = 'fc-migracao';

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  function api(metodo, corpo, credencial) {
    corpo = Object.assign({ origem: CONFIG.origem, token: CONFIG.token }, credencial || {}, corpo);
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

  function mesmoNome(a, b) {
    var n = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''); };
    return !!n(a) && n(a) === n(b);
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

  function cepFormatado(v) {
    var d = digitos(v);
    return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : (v || '');
  }

  function montarFicha(pj, porPapel, cidadeUf) {
    var cidade = pj.cidadeNome || (typeof pj.cidade === 'string' && /\D/.test(pj.cidade) ? pj.cidade : '');
    var uf = pj.uf || pj.estado || '';
    if (cidade && typeof cidade === 'object') cidade = cidade.nome || '';
    var dados = [
      ['Nome', pj.nome || ''],
      ['CNPJ', cnpjFormatado(pj.cnpj || pj.codigo)],
      ['CEP', cepFormatado(pj.cep)],
      ['Endereço sede completo', pj.endereco || pj.logradouro || ''],
      ['Número', pj.numero || ''],
      ['Complemento', pj.complemento || campoPers(pj, CONFIG.camposCliente.complemento)],
      ['Bairro', pj.bairro || ''],
      ['Inscrição Estadual', campoPers(pj, CONFIG.camposCliente.inscricaoEstadual)],
      ['Inscrição Municipal', campoPers(pj, CONFIG.camposCliente.inscricaoMunicipal)],
      ['Cidade/Estado', cidadeUf || (cidade && uf && String(cidade).indexOf(' - ') === -1 ? cidade + ' - ' + uf : (cidade || uf))],
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
    console.log('  lendo o cliente ' + c.p + ' e ' + c.r.length + ' registro(s) da gestão...');
    var pj = await dadosPessoa(c.p);
    if (!pj) throw new Error('cliente ' + c.p + ' não encontrado');
    var vistos = {};
    var vinculos = [];
    var porPapel = PAPEIS.map(function () { return []; });
    for (var i = 0; i < c.r.length; i++) {
      var reg = await api('Registro/dados', { id: c.r[i] });
      var pessoas = reg && reg.success && reg.dados && Array.isArray(reg.dados.pessoas) ? reg.dados.pessoas : [];
      for (var j = 0; j < pessoas.length; j++) {
        var p = pessoas[j];
        var tipo = String(p.tipo || '');
        if (!p.id || String(p.id) === String(c.p) || mesmoNome(p.nome, pj.nome)) continue;
        if (!vistos['v:' + p.id]) {
          vistos['v:' + p.id] = true;
          vinculos.push({ id: String(p.id), tipo: tipo, nome: p.nome || '' });
        }
        var idx = PAPEIS.findIndex(function (papel) { return papel.tiposGestao.indexOf(tipo) !== -1; });
        if (idx === -1 || vistos[idx + ':' + p.id]) continue;
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
    var ficha = montarFicha(pj, porPapel, c.c);
    var link = CONFIG.linkBase + '?ficha=' + await compactar(ficha);
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
      pessoasSecundarias: prep.vinculos.map(function (v) { return v.tipo ? { id: v.id, tipo: v.tipo } : { id: v.id }; }),
      camposPersonalizados: prep.campos
    };
    var antes = await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas });
    var idsAntes = (antes && antes.success && Array.isArray(antes.dados) ? antes.dados : []).map(function (x) { return String(x.id); });
    console.log('  enviando o evento ' + CONFIG.eventoCriaFicha + ' com ' + prep.vinculos.length + ' vínculo(s)...');
    var r = await api('Evento/cadastro', corpo, { origem: CONFIG.eventoOrigem, token: CONFIG.eventoToken });
    console.log('  resposta do evento:', JSON.stringify(r));
    if (!r || r.success === false) throw new Error('Evento/cadastro recusado: ' + JSON.stringify(r).slice(0, 300));
    var registro = null;
    for (var t = 0; t < 20 && !registro; t++) {
      await esperar(1500);
      var l = await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas });
      var lista = l && l.success && Array.isArray(l.dados) ? l.dados : [];
      if (t === 0 || t % 5 === 4) console.log('  procurando o registro novo no processo ' + CONFIG.processoFichas + ' (tentativa ' + (t + 1) + '/20, registros do cliente: ' + lista.length + ')');
      registro = lista.filter(function (x) { return x.codigoRegistro === cod; })[0] ||
        lista.filter(function (x) { return idsAntes.indexOf(String(x.id)) === -1; })
          .sort(function (a, b) { return Number(b.id) - Number(a.id); })[0] || null;
    }
    if (!registro) return { evento: r, registro: '', vinculosCorrigidos: 0, linkGravado: false };
    var reg = await api('Registro/dados', { id: registro.id });
    var pessoas = reg && reg.success && reg.dados && Array.isArray(reg.dados.pessoas) ? reg.dados.pessoas : [];
    var faltando = prep.vinculos.filter(function (v) {
      return !pessoas.some(function (p) { return String(p.id) === v.id && String(p.tipo || '') === v.tipo; });
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
    if (!teste && (CONFIG.token.indexOf('COLE_') === 0 || CONFIG.eventoCriaFicha.indexOf('COLE_') === 0 || CONFIG.eventoToken.indexOf('COLE_') === 0)) {
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
      if (!teste && progresso[c.p] && (progresso[c.p].registro || progresso[c.p].evento)) continue;
      if (opcoes.pular && opcoes.pular.indexOf(c.p) !== -1) continue;
      feitos++;
      console.log('#' + feitos + ' começando cliente ' + c.p);
      try {
        var prep = await prepararCliente(c);
        var resumo = 'Vínculos (' + prep.vinculos.length + '): ' + prep.vinculos.map(function (v) { return v.nome + ' [tipo ' + (v.tipo || 'sem tipo') + ']'; }).join(', ');
        if (teste) {
          console.log('#' + feitos, prep.pj.nome, '\n  ' + resumo, '\n  vínculos:', prep.vinculos, '\n  campos:', prep.campos, '\n  dados do cliente (para conferir os nomes das propriedades):', prep.pj);
          relatorio.push([c.p, prep.pj.nome, 'teste', '', prep.vinculos.length, '', prep.link, resumo]);
        } else {
          var res = await criarRegistro(c, prep);
          progresso[c.p] = { evento: String((res.evento && res.evento.dados && res.evento.dados.id) || 'enviado'), registro: res.registro, quando: new Date().toISOString() };
          salvarProgresso(progresso);
          console.log('#' + feitos, prep.pj.nome, '-> registro', res.registro || '(não encontrado)', '| vínculos corrigidos:', res.vinculosCorrigidos, '| link gravado:', res.linkGravado);
          relatorio.push([c.p, prep.pj.nome, res.registro ? 'criado' : 'evento aceito (registro pelo fluxo)', res.registro, prep.vinculos.length, res.linkGravado ? 'sim' : 'conferir', prep.link, resumo]);
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

  function listaDe(r) { return r && r.success && Array.isArray(r.dados) ? r.dados : []; }

  async function processoGestao() {
    if (CONFIG.processoGestao) return CONFIG.processoGestao;
    for (var i = 0; i < CLIENTES.length && i < 10; i++) {
      var lista = listaDe(await api('Contato/listarOportunidades', { id: CLIENTES[i].p }));
      for (var j = 0; j < lista.length; j++) {
        var x = lista[j];
        if (CLIENTES[i].r.indexOf(String(x.id)) === -1) continue;
        var proc = x.processo && typeof x.processo === 'object' ? x.processo.id : (x.processo || x.idProcesso || x.processoId);
        if (proc) {
          CONFIG.processoGestao = String(proc);
          console.log('Processo de gestão: ' + CONFIG.processoGestao);
          return CONFIG.processoGestao;
        }
      }
    }
    throw new Error('não consegui descobrir o número do processo de gestão; preencha processoGestao no início do script');
  }

  async function situacaoCliente(idCliente) {
    var gestao = await processoGestao();
    var fichas = listaDe(await api('Contato/listarOportunidades', { id: idCliente, processo: CONFIG.processoFichas }));
    var registros = listaDe(await api('Contato/listarOportunidades', { id: idCliente, processo: gestao })).map(function (x) { return String(x.id); });
    return { fichas: fichas.map(function (x) { return String(x.id); }), registros: registros };
  }

  async function enviarCliente(c, teste) {
    var prep = await prepararCliente(c);
    console.log('  ' + prep.pj.nome + ' | vínculos (' + prep.vinculos.length + '): ' + prep.vinculos.map(function (v) { return v.nome + ' [tipo ' + (v.tipo || 'sem tipo') + ']'; }).join(', '));
    if (teste) return { prep: prep, res: null };
    var res = await criarRegistro(c, prep);
    var progresso = lerProgresso();
    progresso[c.p] = { evento: String((res.evento && res.evento.dados && res.evento.dados.id) || 'enviado'), registro: res.registro, quando: new Date().toISOString() };
    salvarProgresso(progresso);
    return { prep: prep, res: res };
  }

  window.fichaMigrarCliente = async function (idCliente, opcoes) {
    opcoes = opcoes || {};
    idCliente = String(idCliente || '').replace(/\D/g, '');
    if (!idCliente) { console.error('Informe o ID do cliente. Ex.: fichaMigrarCliente(\'1264416\')'); return; }
    var sit = await situacaoCliente(idCliente);
    console.log('Cliente ' + idCliente + ': registros na gestão: ' + (sit.registros.join(', ') || 'nenhum') + ' | fichas que já existem: ' + (sit.fichas.join(', ') || 'nenhuma'));
    if (sit.fichas.length && !opcoes.forcar) {
      console.warn('Este cliente já tem ficha. Para criar outra mesmo assim: fichaMigrarCliente(\'' + idCliente + '\', { forcar: true })');
      return;
    }
    if (!sit.registros.length) { console.warn('Este cliente não tem registro no processo de gestão.'); return; }
    var feito = await enviarCliente({ p: idCliente, r: sit.registros, c: opcoes.cidade }, opcoes.teste === true);
    if (!feito.res) { console.log('[TESTE] nada foi criado. Link da ficha:', feito.prep.link); return; }
    console.log('Pronto: ' + feito.prep.pj.nome + ' -> ' + (feito.res.registro ? 'registro ' + feito.res.registro : 'evento aceito (o fluxo cria o registro)'));
  };

  function lerCsv(texto) {
    texto = texto.replace(/^﻿/, '');
    var sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    var linhas = [], linha = [], campo = '', aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (aspas) {
        if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (ch === '"') aspas = false;
        else campo += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ''; }
      else if (ch === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
      else campo += ch;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    var cab = linhas.shift() || [];
    return linhas.filter(function (l) { return l.length > 1; }).map(function (l) {
      var o = {};
      cab.forEach(function (c, k) { o[c.trim()] = (l[k] || '').trim(); });
      return o;
    });
  }

  function clientesDoCsv(linhas) {
    var vazio = function (v) { return !v || v === '-' || v === '--' || v === '- - -'; };
    var mapa = {};
    linhas.forEach(function (r) {
      var p = r['Identificador da pessoa'];
      if (vazio(p)) return;
      var c = mapa[p] || (mapa[p] = { p: p, r: [], nome: r['Nome da pessoa'] || '' });
      if (!vazio(r['Identificador']) && c.r.indexOf(r['Identificador']) === -1) c.r.push(r['Identificador']);
      if (!c.c && !vazio(r['Cidade'])) c.c = r['Cidade'] + (vazio(r['UF']) ? '' : ' - ' + r['UF']);
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }

  function escolherArquivo() {
    return new Promise(function (ok) {
      var caixa = document.createElement('div');
      caixa.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif';
      caixa.innerHTML = '<div style="background:#fff;padding:24px 28px;border-radius:8px;max-width:420px;text-align:center"><p style="margin:0 0 16px;font-size:15px">Escolha a exportação (CSV) do processo de gestão</p><input type="file" accept=".csv,text/csv"><p style="margin:16px 0 0"><button type="button" style="padding:6px 14px;cursor:pointer">Cancelar</button></p></div>';
      document.body.appendChild(caixa);
      caixa.querySelector('input').addEventListener('change', function (e) { var f = e.target.files[0]; caixa.remove(); ok(f || null); });
      caixa.querySelector('button').addEventListener('click', function () { caixa.remove(); ok(null); });
    });
  }

  window.fichaMigrarNovos = async function (opcoes) {
    opcoes = opcoes || {};
    var teste = opcoes.teste === true;
    var arquivo = await escolherArquivo();
    if (!arquivo) { console.warn('Nenhum arquivo escolhido.'); return; }
    var clientes = clientesDoCsv(lerCsv(await arquivo.text()));
    if (!clientes.length) { console.error('Não achei a coluna "Identificador da pessoa" no arquivo. Use a exportação do processo de gestão.'); return; }
    var gestao = await processoGestao();
    console.log((teste ? '[TESTE - nada será criado] ' : '') + 'Clientes no arquivo: ' + clientes.length + '. Verificando quem ainda não tem ficha...');
    var relatorio = [], enviados = 0, comFicha = 0;
    for (var i = 0; i < clientes.length; i++) {
      var c = clientes[i];
      try {
        var fichas = listaDe(await api('Contato/listarOportunidades', { id: c.p, processo: CONFIG.processoFichas }));
        if (fichas.length) { comFicha++; continue; }
        var registros = listaDe(await api('Contato/listarOportunidades', { id: c.p, processo: gestao })).map(function (x) { return String(x.id); });
        c.r = registros.length ? registros : c.r;
        console.log('#' + (enviados + 1) + ' sem ficha: ' + (c.nome || c.p) + ' (cliente ' + c.p + ')');
        var feito = await enviarCliente(c, teste);
        enviados++;
        relatorio.push([c.p, feito.prep.pj.nome, teste ? 'teste' : (feito.res.registro ? 'criado' : 'evento aceito (registro pelo fluxo)'), feito.res ? feito.res.registro : '', feito.prep.vinculos.length, '', feito.prep.link, '']);
      } catch (e) {
        console.warn('cliente', c.p, 'erro:', e.message);
        relatorio.push([c.p, c.nome, 'erro', '', '', '', '', e.message]);
      }
      await esperar(CONFIG.pausaMs);
    }
    console.log('Fim. Já tinham ficha: ' + comFicha + ' | ' + (teste ? 'seriam enviados: ' : 'enviados: ') + enviados + ' | erros: ' + relatorio.filter(function (l) { return l[2] === 'erro'; }).length);
    if (relatorio.length) baixarRelatorio(relatorio);
  };

  window.fichaMigracaoZerar = function () { localStorage.removeItem(CHAVE); console.log('Progresso apagado.'); };

  console.log('Script carregado. Só quem falta: fichaMigrarNovos()  |  Um cliente: fichaMigrarCliente(\'ID_DO_CLIENTE\')');
})();
