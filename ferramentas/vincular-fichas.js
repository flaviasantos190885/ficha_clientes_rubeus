(function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '903',
    token: 'COLE_O_TOKEN_AQUI',
    processoGestao: '76',
    tipoNaoIdentificado: '',
    tiposFicha: ['93', '82', '2', '78'],
    baseLegal: '4',
    assinaturas: ['3', '5'],
    pausaMs: 300
  };

  var NOMES_TIPO = { '93': 'Responsável pelo projeto', '82': 'Responsável legal', '2': 'Testemunha', '78': 'Gerente financeiro' };

  var DADOS = __DADOS__;

  var CHAVE = 'fc-vinculos-fichas';

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function semAcento(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function normNome(v) {
    return semAcento(v).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
      .filter(function (t) { return t && ['de', 'da', 'do', 'das', 'dos', 'e'].indexOf(t) === -1; }).join(' ');
  }
  function mesmoNome(a, b) {
    a = normNome(a); b = normNome(b);
    if (!a || !b) return false;
    if (a === b) return true;
    var ta = a.split(' '), tb = b.split(' ');
    var curto = ta.length <= tb.length ? ta : tb, longo = ta.length <= tb.length ? tb : ta;
    return curto.length >= 2 && curto[0] === longo[0] && curto.every(function (t) { return longo.indexOf(t) !== -1; });
  }

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

  function idDaResposta(r) {
    if (!r || r.success === false) return '';
    var d = primeiro(r.dados);
    if (d && typeof d === 'object' && d.id) return String(d.id);
    if (d && (typeof d === 'string' || typeof d === 'number') && /^\d+$/.test(String(d))) return String(d);
    if (r.id) return String(r.id);
    return '';
  }

  function emailsDe(p) {
    var out = [];
    var juntar = function (v) {
      if (!v) return;
      if (Array.isArray(v)) return v.forEach(juntar);
      if (typeof v === 'object') return juntar(v.email || v.principal || v.valor);
      if (/@/.test(v)) out.push(String(v).toLowerCase().trim());
    };
    if (p) { juntar(p.emails); juntar(p.email); juntar(p.emailPrincipal); }
    return out;
  }

  function telefonesDe(p) {
    var out = [];
    var juntar = function (v) {
      if (!v) return;
      if (Array.isArray(v)) return v.forEach(juntar);
      if (typeof v === 'object') return juntar(v.numero || v.telefone || v.principal);
      if (digitos(v)) out.push(digitos(v));
    };
    if (p) { juntar(p.telefones); juntar(p.telefone); juntar(p.telefonePrincipal); }
    return out;
  }

  async function procurarPor(campo, valor, confere) {
    var corpo = {};
    corpo[campo] = valor;
    var r = await api('Contato/dadosPessoa', corpo);
    var d = r && r.success ? primeiro(r.dados) : null;
    if (d && d.id && confere(d)) return d;
    return null;
  }

  async function acharPessoa(p, noRegistro) {
    var doRegistro = noRegistro.filter(function (x) { return x.nome && mesmoNome(x.nome, p.nome); })[0];
    if (doRegistro) return { id: String(doRegistro.id), via: 'já está no registro (' + doRegistro.nome + ')' };
    var cpf = digitos(p.cpf);
    if (cpf.length === 11) {
      var porCpf = await procurarPor('cpf', cpf, function (d) { return digitos(d.cpf) === cpf; });
      if (porCpf) return { id: String(porCpf.id), via: 'CPF', dados: porCpf };
    }
    var email = String(p.email || '').toLowerCase();
    if (email) {
      var porEmail = await procurarPor('email', email, function (d) { return emailsDe(d).indexOf(email) !== -1; });
      if (porEmail) return { id: String(porEmail.id), via: 'e-mail', dados: porEmail };
    }
    return null;
  }

  function divergencias(p, d) {
    if (!d) return '';
    var out = [];
    if (d.nome && !mesmoNome(d.nome, p.nome)) out.push('nome na Rubeus: ' + d.nome);
    var tel = digitos(p.telefone);
    var tels = telefonesDe(d);
    if (tel && tels.length && !tels.some(function (t) { return t.slice(-8) === tel.slice(-8); })) out.push('telefone na Rubeus: ' + tels.join(', '));
    var email = String(p.email || '').toLowerCase();
    var emails = emailsDe(d);
    if (email && emails.length && emails.indexOf(email) === -1) out.push('e-mail na Rubeus: ' + emails.join(', '));
    return out.join(' | ');
  }

  async function cadastrar(p) {
    var corpo = {
      nome: p.nome,
      naturezaJuridica: 1,
      baseLegal: CONFIG.baseLegal,
      assinaturas: CONFIG.assinaturas.map(function (a) { return { id: a }; })
    };
    if (p.email) corpo.emailPrincipal = p.email;
    if (digitos(p.telefone)) corpo.telefonePrincipal = digitos(p.telefone);
    if (digitos(p.cpf)) corpo.cpf = digitos(p.cpf);
    var r = await api('Contato/cadastro', corpo);
    var id = idDaResposta(r);
    if (!id) throw new Error('cadastro de ' + p.nome + ' recusado: ' + JSON.stringify(r).slice(0, 200));
    return id;
  }

  async function registrosDoCliente(c) {
    var lista = listaDe(await api('Contato/listarOportunidades', { id: c.cliente, processo: CONFIG.processoGestao })).map(function (x) { return String(x.id); });
    return lista.length ? lista : c.registros;
  }

  async function pessoasDoRegistro(id) {
    var r = await api('Registro/dados', { id: id });
    return r && r.success && r.dados && Array.isArray(r.dados.pessoas) ? r.dados.pessoas : null;
  }

  function planejar(pessoas, alvos) {
    var lista = pessoas.map(function (p) { return { id: String(p.id), tipo: String(p.tipo || ''), principal: String(p.principal || '0') }; });
    var mudancas = [];
    alvos.forEach(function (a) {
      if (lista.some(function (p) { return p.id === a.id && p.tipo === a.tipo; })) return;
      var trocar = a.naoIdentificado && CONFIG.tipoNaoIdentificado &&
        lista.filter(function (p) { return p.id === a.id && p.tipo === CONFIG.tipoNaoIdentificado; })[0];
      if (trocar) {
        trocar.tipo = a.tipo;
        mudancas.push(a.nome + ': tipo ' + CONFIG.tipoNaoIdentificado + ' -> ' + a.tipo);
      } else {
        lista.push({ id: a.id, tipo: a.tipo, principal: '0' });
        mudancas.push(a.nome + ': vinculado como ' + a.tipo);
      }
    });
    return { lista: lista, mudancas: mudancas };
  }

  function lerProgresso() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; } }
  function salvarProgresso(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {} }

  function baixar(nome, linhas) {
    var cab = ['ID do cliente', 'Cliente', 'Pessoa', 'Papel', 'Tipo', 'ID da pessoa', 'Como foi achada', 'Registros', 'Situação', 'Divergências (não alteradas)'];
    var csv = [cab].concat(linhas).map(function (l) {
      return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    a.click();
  }

  window.fichaVincular = async function (opcoes) {
    opcoes = opcoes || {};
    var teste = opcoes.teste !== false;
    if (opcoes.tipoNaoIdentificado) CONFIG.tipoNaoIdentificado = String(opcoes.tipoNaoIdentificado);
    if (CONFIG.token.indexOf('COLE_') === 0) { console.error('Token não configurado.'); return; }
    if (!teste && !CONFIG.tipoNaoIdentificado && DADOS.some(function (c) { return c.pessoas.some(function (p) { return p.situacao.indexOf('não identificado') !== -1; }); })) {
      console.error('Rode primeiro o teste e informe o tipo de "não identificado": fichaVincular({ teste: false, tipoNaoIdentificado: \'NÚMERO\' })');
      return;
    }
    var progresso = lerProgresso();
    var lista = opcoes.clientes ? DADOS.filter(function (c) { return opcoes.clientes.indexOf(c.cliente) !== -1; }) : DADOS;
    var limite = opcoes.limite || lista.length;
    var relatorio = [], feitos = 0, tiposNaoIdent = {}, contagem = { achadas: 0, criadas: 0, vinculos: 0, erros: 0 };
    console.log((teste ? '[TESTE - nada será alterado] ' : '') + 'Clientes: ' + lista.length + ' | limite: ' + limite);
    for (var i = 0; i < lista.length && feitos < limite; i++) {
      var c = lista[i];
      if (!teste && progresso[c.cliente]) continue;
      feitos++;
      console.log('#' + feitos + ' ' + c.nome + ' (' + c.pessoas.length + ' pessoa(s))');
      try {
        var registros = await registrosDoCliente(c);
        var porRegistro = {};
        var noRegistro = [];
        for (var r = 0; r < registros.length; r++) {
          var ps = await pessoasDoRegistro(registros[r]);
          if (!ps) throw new Error('não consegui ler o registro ' + registros[r]);
          porRegistro[registros[r]] = ps;
          noRegistro = noRegistro.concat(ps);
        }
        var alvos = [];
        for (var j = 0; j < c.pessoas.length; j++) {
          var p = c.pessoas[j];
          var achada = await acharPessoa(p, noRegistro);
          var id = achada ? achada.id : '';
          var via = achada ? achada.via : 'novo cadastro';
          if (achada) contagem.achadas++;
          if (p.situacao.indexOf('não identificado') !== -1 && id) {
            noRegistro.filter(function (x) { return String(x.id) === id; }).forEach(function (x) {
              if (CONFIG.tiposFicha.indexOf(String(x.tipo)) === -1) tiposNaoIdent[x.tipo] = (tiposNaoIdent[x.tipo] || 0) + 1;
            });
          }
          if (!id && !teste) { id = await cadastrar(p); contagem.criadas++; }
          var div = divergencias(p, achada && achada.dados);
          console.log('   ' + p.nome + ' [' + NOMES_TIPO[p.tipo] + '] -> ' + (id || '(seria cadastrado)') + ' | ' + via + (div ? ' | ' + div : ''));
          alvos.push({ id: id, tipo: p.tipo, nome: p.nome, naoIdentificado: p.situacao.indexOf('não identificado') !== -1 });
          relatorio.push([c.cliente, c.nome, p.nome, NOMES_TIPO[p.tipo], p.tipo, id, via, registros.join(', '), '', div]);
          await esperar(CONFIG.pausaMs);
        }
        var linhasCliente = relatorio.slice(relatorio.length - c.pessoas.length);
        var resultadoRegistros = [];
        for (var k = 0; k < registros.length; k++) {
          var plano = planejar(porRegistro[registros[k]], alvos.filter(function (a) { return a.id; }));
          if (!plano.mudancas.length) { resultadoRegistros.push(registros[k] + ': nada a mudar'); continue; }
          if (teste) { resultadoRegistros.push(registros[k] + ': ' + plano.mudancas.join('; ')); continue; }
          var resp = await api('Oportunidade/alterarPessoas', { id: registros[k], pessoas: plano.lista });
          var depois = await pessoasDoRegistro(registros[k]) || [];
          var faltando = alvos.filter(function (a) { return !depois.some(function (x) { return String(x.id) === a.id && String(x.tipo) === a.tipo; }); });
          contagem.vinculos += plano.mudancas.length - faltando.length;
          resultadoRegistros.push(registros[k] + ': ' + (faltando.length ? 'ATENÇÃO, não entrou: ' + faltando.map(function (a) { return a.nome + ' (' + a.tipo + ')'; }).join(', ') + ' | resposta: ' + JSON.stringify(resp).slice(0, 150) : 'ok, ' + plano.mudancas.length + ' mudança(s)'));
          await esperar(CONFIG.pausaMs);
        }
        console.log('   registros: ' + resultadoRegistros.join(' || '));
        linhasCliente.forEach(function (l) { l[8] = teste ? 'teste' : resultadoRegistros.join(' || '); });
        if (!teste) { progresso[c.cliente] = new Date().toISOString(); salvarProgresso(progresso); }
      } catch (e) {
        contagem.erros++;
        console.warn('   erro:', e.message);
        relatorio.push([c.cliente, c.nome, '', '', '', '', '', '', 'erro: ' + e.message, '']);
      }
    }
    console.log('Fim. Pessoas já existentes: ' + contagem.achadas + ' | cadastradas: ' + contagem.criadas + ' | vínculos feitos: ' + contagem.vinculos + ' | clientes com erro: ' + contagem.erros);
    if (Object.keys(tiposNaoIdent).length) console.log('Tipos encontrados para quem está como "não identificado" (tipo: quantidade):', JSON.stringify(tiposNaoIdent));
    if (relatorio.length) baixar('vinculos-fichas-' + (teste ? 'teste-' : '') + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv', relatorio);
  };

  window.fichaVinculosZerar = function () { localStorage.removeItem(CHAVE); console.log('Progresso apagado.'); };

  console.log('Script de vínculos carregado (' + DADOS.length + ' clientes). Teste: fichaVincular({ limite: 5 })  |  Real: fichaVincular({ teste: false, limite: 2 })');
})();
