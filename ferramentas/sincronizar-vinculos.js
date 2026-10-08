(function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '903',
    token: 'COLE_O_TOKEN_AQUI',
    processoGestao: '76',
    processoFichas: '42',
    pausaMs: 300
  };

  var CLIENTES = __CLIENTES__;

  var CHAVE = 'fc-sincronizar-vinculos';

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

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

  function listaDe(r) { return r && r.success && Array.isArray(r.dados) ? r.dados : []; }

  async function registros(cliente, processo) {
    return listaDe(await api('Contato/listarOportunidades', { id: cliente, processo: processo })).map(function (x) { return String(x.id); });
  }

  async function pessoasDoRegistro(id) {
    var r = await api('Registro/dados', { id: id });
    return r && r.success && r.dados && Array.isArray(r.dados.pessoas) ? r.dados.pessoas : null;
  }

  function chave(p) { return String(p.id) + ':' + String(p.tipo || ''); }

  function lerProgresso() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; } }
  function salvarProgresso(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {} }

  function baixar(nome, linhas) {
    var cab = ['ID do cliente', 'Cliente', 'Registro(s) na gestão', 'Registro na fichas', 'Pessoa', 'ID da pessoa', 'Tipo', 'Situação'];
    var csv = [cab].concat(linhas).map(function (l) {
      return l.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    a.click();
  }

  window.fichaSincronizar = async function (opcoes) {
    opcoes = opcoes || {};
    var teste = opcoes.teste !== false;
    if (CONFIG.token.indexOf('COLE_') === 0) { console.error('Token não configurado.'); return; }
    var lista = opcoes.clientes ? opcoes.clientes.map(String) : CLIENTES;
    var limite = opcoes.limite || lista.length;
    var progresso = lerProgresso();
    var relatorio = [], pendentes = [], feitos = 0;
    var total = { acrescentados: 0, jaEstavam: 0, semFicha: 0, semGestao: 0, erros: 0 };
    console.log((teste ? '[TESTE - nada será alterado] ' : '') + 'Clientes: ' + lista.length + ' | limite: ' + limite);
    for (var i = 0; i < lista.length && feitos < limite; i++) {
      var cliente = lista[i];
      if (!teste && progresso[cliente] && !(opcoes.refazer && opcoes.refazer.map(String).indexOf(cliente) !== -1)) continue;
      feitos++;
      try {
        var gestao = await registros(cliente, CONFIG.processoGestao);
        var fichas = await registros(cliente, CONFIG.processoFichas);
        if (!fichas.length) { total.semFicha++; relatorio.push([cliente, '', gestao.join(', '), '', '', '', '', 'cliente sem registro em Fichas']); console.log('#' + feitos + ' cliente ' + cliente + ': sem registro em Fichas'); continue; }
        if (!gestao.length) { total.semGestao++; relatorio.push([cliente, '', '', fichas.join(', '), '', '', '', 'cliente sem registro na gestão']); console.log('#' + feitos + ' cliente ' + cliente + ': sem registro na gestão'); continue; }

        var nomeCliente = '';
        var vindas = {};
        for (var g = 0; g < gestao.length; g++) {
          var ps = await pessoasDoRegistro(gestao[g]);
          if (!ps) throw new Error('não consegui ler o registro ' + gestao[g] + ' da gestão');
          ps.forEach(function (p) {
            if (String(p.id) === cliente) { nomeCliente = nomeCliente || p.nome || ''; return; }
            if (String(p.principal) === '1') return;
            vindas[chave(p)] = { id: String(p.id), tipo: String(p.tipo || ''), nome: p.nome || '' };
          });
        }
        var alvos = Object.keys(vindas).map(function (k) { return vindas[k]; });

        var resumo = [];
        for (var f = 0; f < fichas.length; f++) {
          var atuais = await pessoasDoRegistro(fichas[f]);
          if (!atuais) throw new Error('não consegui ler o registro ' + fichas[f] + ' de Fichas');
          var existentes = {};
          atuais.forEach(function (p) { existentes[chave(p)] = true; });
          var faltam = alvos.filter(function (a) { return !existentes[chave(a)]; });
          alvos.filter(function (a) { return existentes[chave(a)]; }).forEach(function (a) {
            total.jaEstavam++;
            relatorio.push([cliente, nomeCliente, gestao.join(', '), fichas[f], a.nome, a.id, a.tipo, 'já estava']);
          });
          if (!faltam.length) { resumo.push(fichas[f] + ': nada a acrescentar'); continue; }
          if (teste) {
            faltam.forEach(function (a) { relatorio.push([cliente, nomeCliente, gestao.join(', '), fichas[f], a.nome, a.id, a.tipo, 'seria acrescentado']); });
            resumo.push(fichas[f] + ': acrescentaria ' + faltam.length + ' (' + faltam.map(function (a) { return a.nome + ' [' + a.tipo + ']'; }).join(', ') + ')');
            continue;
          }
          var nova = atuais.map(function (p) { return { id: String(p.id), tipo: String(p.tipo || ''), principal: String(p.principal || '0') }; })
            .concat(faltam.map(function (a) { return { id: a.id, tipo: a.tipo, principal: '0' }; }));
          var resp = await api('Oportunidade/alterarPessoas', { id: fichas[f], pessoas: nova });
          var depois = await pessoasDoRegistro(fichas[f]) || [];
          var depoisChaves = {};
          depois.forEach(function (p) { depoisChaves[chave(p)] = true; });
          var naoEntraram = faltam.filter(function (a) { return !depoisChaves[chave(a)]; });
          var perdidos = atuais.filter(function (p) { return !depoisChaves[chave(p)]; });
          total.acrescentados += faltam.length - naoEntraram.length;
          faltam.forEach(function (a) {
            relatorio.push([cliente, nomeCliente, gestao.join(', '), fichas[f], a.nome, a.id, a.tipo, naoEntraram.indexOf(a) === -1 ? 'acrescentado' : 'NÃO ENTROU']);
          });
          if (perdidos.length) console.warn('   ATENÇÃO: sumiram do registro ' + fichas[f] + ': ' + perdidos.map(chave).join(', '));
          if (naoEntraram.length || perdidos.length) pendentes.push(cliente);
          resumo.push(fichas[f] + ': ' + (naoEntraram.length ? 'ATENÇÃO, não entraram ' + naoEntraram.map(chave).join(', ') + (resp && resp.success === false ? ' | resposta: ' + JSON.stringify(resp).slice(0, 150) : '') : 'acrescentados ' + faltam.length));
          await esperar(CONFIG.pausaMs);
        }
        console.log('#' + feitos + ' ' + (nomeCliente || cliente) + ' (gestão ' + gestao.join(', ') + ') -> ' + resumo.join(' || '));
        if (!teste && pendentes.indexOf(cliente) === -1) { progresso[cliente] = new Date().toISOString(); salvarProgresso(progresso); }
      } catch (e) {
        total.erros++;
        pendentes.push(cliente);
        console.warn('#' + feitos + ' cliente ' + cliente + ': erro ' + e.message);
        relatorio.push([cliente, '', '', '', '', '', '', 'erro: ' + e.message]);
      }
      await esperar(CONFIG.pausaMs);
    }
    console.log('Fim. ' + (teste ? 'Seriam acrescentados: ' + relatorio.filter(function (l) { return l[7] === 'seria acrescentado'; }).length : 'Acrescentados: ' + total.acrescentados) +
      ' | já estavam: ' + total.jaEstavam + ' | clientes sem registro em Fichas: ' + total.semFicha + ' | sem registro na gestão: ' + total.semGestao + ' | erros: ' + total.erros);
    if (pendentes.length) console.log('Para refazer só os que tiveram problema: fichaSincronizar({ teste: false, clientes: ' + JSON.stringify(pendentes) + ', refazer: ' + JSON.stringify(pendentes) + ' })');
    if (relatorio.length) baixar('sincronizar-vinculos-' + (teste ? 'teste-' : '') + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv', relatorio);
  };

  window.fichaSincronizarZerar = function () { localStorage.removeItem(CHAVE); console.log('Progresso apagado.'); };

  console.log('Script carregado (' + CLIENTES.length + ' clientes). Teste: fichaSincronizar({ limite: 5 })  |  Real: fichaSincronizar({ teste: false })');
})();
