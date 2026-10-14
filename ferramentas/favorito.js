(async function () {
  var CONFIG = {
    api: 'https://crmrbacademy.apprubeus.com.br/api/',
    origem: '903',
    token: 'COLE_O_TOKEN_AQUI'
  };

  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  function api(metodo, corpo) {
    corpo = Object.assign({ origem: CONFIG.origem, token: CONFIG.token }, corpo);
    return fetch(CONFIG.api + metodo, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  var antigo = document.getElementById('fc-favorito');
  if (antigo) antigo.remove();
  var caixa = document.createElement('div');
  caixa.id = 'fc-favorito';
  caixa.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:420px;max-height:60vh;display:flex;flex-direction:column;background:#fff;color:#222;border:1px solid #12857f;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:13px/1.45 Arial,sans-serif';
  caixa.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#12857f;color:#fff;border-radius:7px 7px 0 0"><b>Enviar para Fichas</b><button type="button" style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1">×</button></div><div class="fc-log" style="padding:8px 12px;overflow:auto"></div>';
  caixa.querySelector('button').onclick = function () { caixa.remove(); };
  document.body.appendChild(caixa);
  var areaLog = caixa.querySelector('.fc-log');
  function escrever(txt, cor) {
    var p = document.createElement('div');
    p.textContent = txt;
    if (cor) p.style.color = cor;
    areaLog.appendChild(p);
    areaLog.scrollTop = areaLog.scrollHeight;
  }

  var original = { log: console.log, warn: console.warn, error: console.error };
  function espelhar(ligar) {
    if (!ligar) { Object.assign(console, original); return; }
    console.log = function () { original.log.apply(console, arguments); escrever(Array.from(arguments).map(String).join(' ')); };
    console.warn = function () { original.warn.apply(console, arguments); var t = Array.from(arguments).map(String).join(' '); if (t.indexOf('forcar') === -1) escrever(t, '#a35d00'); };
    console.error = function () { original.error.apply(console, arguments); escrever(Array.from(arguments).map(String).join(' '), '#b00020'); };
  }

  async function descobrirId() {
    var url = location.pathname + location.search + location.hash;
    var pessoa = /(?:contato|pessoa)s?\/(?:[a-z-]+\/)*(\d{4,})/i.exec(url);
    if (pessoa) return pessoa[1];
    var registro = /(?:registro|oportunidade)s?\/(?:[a-z-]+\/)*(\d{3,})/i.exec(url);
    if (registro) {
      var r = await api('Registro/dados', { id: registro[1] });
      var ps = r && r.success && r.dados && Array.isArray(r.dados.pessoas) ? r.dados.pessoas : [];
      var principal = ps.filter(function (p) { return String(p.principal) === '1'; })[0];
      if (principal) return String(principal.id);
    }
    var numero = /(\d{5,})/.exec(url);
    var resposta = prompt('ID do cliente na Rubeus (o número que aparece no endereço da página do contato da empresa):', numero ? numero[1] : '');
    return resposta ? resposta.replace(/\D/g, '') : '';
  }

  async function umCliente(id) {
    escrever('Cliente ' + id + ': começando...', '#12857f');
    var r = await window.fichaMigrarCliente(id);
    if (!r) throw new Error('não consegui verificar o cliente');
    if (r.situacao === 'sem_gestao') { escrever('Este cliente não tem registro no processo de gestão (76). Nada foi feito.', '#b00020'); return 'sem_gestao'; }

    if (r.situacao === 'criado') {
      escrever('Ficha criada em Fichas' + (r.registro ? ' (registro ' + r.registro + ')' : '') + ', já com os vinculados e o link.', '#12857f');
      await esperar(3000);
      await window.fichaSincronizar({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
      escrever('Pronto.', '#12857f');
      return 'criado';
    }

    escrever('Já tem ficha (registro ' + r.registro + '). Levando os vinculados novos da gestão...', '#12857f');
    var sinc = await window.fichaSincronizar({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
    if (!sinc || !sinc.acrescentados) { escrever('Nenhum vinculado novo. Ficha e link já estavam em dia.', '#12857f'); return 'em_dia'; }
    escrever(sinc.acrescentados + ' vínculo(s) acrescentado(s). Atualizando o link da ficha...', '#12857f');
    var links = await window.fichaAtualizarLinks({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
    var ok = links && !links.pendentes.length;
    escrever(ok ? 'Pronto: link atualizado.' : 'Os vínculos foram levados, mas o link não foi atualizado. Veja a mensagem acima.', ok ? '#12857f' : '#b00020');
    return ok ? 'atualizado' : 'erro';
  }

  function clientesDaLista() {
    var vistos = {}, out = [];
    document.querySelectorAll('a[href*="contato/"]').forEach(function (a) {
      var m = /contato\/(\d+)/.exec(a.getAttribute('href'));
      if (!m || vistos[m[1]]) return;
      if (!/registro\/\d+/.test(a.getAttribute('href')) && !document.querySelector('a[href*="contato/' + m[1] + '/registro/"]')) return;
      vistos[m[1]] = true;
      var nomeLink = document.querySelector('a[href$="contato/' + m[1] + '"]') || a;
      var texto = (nomeLink.innerText || nomeLink.textContent || '').trim();
      out.push({ id: m[1], nome: texto && !/^\d+$/.test(texto) ? texto : '' });
    });
    return out;
  }

  function rolavel(el) {
    while (el && el !== document.body) {
      var st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 10) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  async function carregarTudo() {
    var anterior = -1, parado = 0;
    for (var i = 0; i < 40 && parado < 3; i++) {
      var links = document.querySelectorAll('a[href*="/registro/"]');
      var n = links.length;
      if (n === anterior) parado++; else parado = 0;
      anterior = n;
      if (!n) break;
      links[n - 1].scrollIntoView({ block: 'end' });
      var caixaRolagem = rolavel(links[n - 1]);
      caixaRolagem.scrollTop = caixaRolagem.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
      await esperar(900);
    }
  }

  async function modoLista() {
    escrever('Lendo a lista do processo 76 (rolando para carregar todos)...', '#12857f');
    await carregarTudo();
    var lista = clientesDaLista();
    if (!lista.length) { escrever('Não achei clientes na tela. Abra a visualização em LISTA (ícone ☰) do processo 76 e use o filtro de período.', '#b00020'); return; }
    escrever(lista.length + ' cliente(s) na lista. Verificando quem já tem ficha...', '#12857f');
    var semFicha = [];
    for (var i = 0; i < lista.length; i++) {
      var f = await api('Contato/listarOportunidades', { id: lista[i].id, processo: '42' });
      var tem = f && f.success && Array.isArray(f.dados) && f.dados.length;
      if (!tem) semFicha.push(lista[i]);
      await esperar(150);
    }
    if (!semFicha.length) { escrever('Todos os ' + lista.length + ' clientes da lista já têm ficha. Nada a fazer.', '#12857f'); return; }
    var nomes = semFicha.map(function (c) { return '• ' + (c.nome || 'cliente ' + c.id); }).join('\n');
    escrever(semFicha.length + ' sem ficha: ' + semFicha.map(function (c) { return c.nome || c.id; }).join(', '));
    if (!confirm('Criar a ficha de ' + semFicha.length + ' cliente(s) sem ficha?\n\n' + nomes.slice(0, 1500))) { escrever('Cancelado. Nada foi feito.', '#a35d00'); return; }
    var resumo = { criado: 0, outros: 0, erro: 0 };
    espelhar(true);
    for (var j = 0; j < semFicha.length; j++) {
      escrever('— ' + (j + 1) + '/' + semFicha.length + ' —', '#666');
      try {
        var r = await umCliente(semFicha[j].id);
        if (r === 'criado') resumo.criado++; else resumo.outros++;
      } catch (e) {
        resumo.erro++;
        escrever('Erro no cliente ' + semFicha[j].id + ': ' + e.message, '#b00020');
        if (/CRIOU um registro novo/.test(e.message)) break;
      }
    }
    espelhar(false);
    escrever('Fim: ' + resumo.criado + ' ficha(s) criada(s)' + (resumo.outros ? ', ' + resumo.outros + ' sem alteração' : '') + (resumo.erro ? ', ' + resumo.erro + ' com erro' : '') + '.', resumo.erro ? '#b00020' : '#12857f');
  }

  try {
    if (/processo\/76\/(lista|funil)/.test(location.pathname)) { await modoLista(); return; }
    var id = await descobrirId();
    if (!id) { escrever('Nenhum ID informado.', '#b00020'); return; }
    espelhar(true);
    await umCliente(id);
  } catch (e) {
    escrever('Erro: ' + e.message, '#b00020');
  } finally {
    espelhar(false);
  }
})();
