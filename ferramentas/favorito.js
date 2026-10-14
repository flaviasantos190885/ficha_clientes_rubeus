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

  try {
    var id = await descobrirId();
    if (!id) { escrever('Nenhum ID informado.', '#b00020'); return; }
    escrever('Cliente ' + id + ': começando...', '#12857f');
    espelhar(true);

    var r = await window.fichaMigrarCliente(id);
    if (!r) throw new Error('não consegui verificar o cliente');
    if (r.situacao === 'sem_gestao') { escrever('Este cliente não tem registro no processo de gestão (76). Nada foi feito.', '#b00020'); return; }

    if (r.situacao === 'criado') {
      escrever('Ficha criada em Fichas' + (r.registro ? ' (registro ' + r.registro + ')' : '') + ', já com os vinculados e o link.', '#12857f');
      await esperar(3000);
      await window.fichaSincronizar({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
      escrever('Pronto.', '#12857f');
      return;
    }

    escrever('Já tem ficha (registro ' + r.registro + '). Levando os vinculados novos da gestão...', '#12857f');
    var sinc = await window.fichaSincronizar({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
    if (!sinc || !sinc.acrescentados) { escrever('Nenhum vinculado novo. Ficha e link já estavam em dia.', '#12857f'); return; }
    escrever(sinc.acrescentados + ' vínculo(s) acrescentado(s). Atualizando o link da ficha...', '#12857f');
    var links = await window.fichaAtualizarLinks({ teste: false, clientes: [id], refazer: [id], semRelatorio: true });
    escrever(links && !links.pendentes.length ? 'Pronto: link atualizado.' : 'Os vínculos foram levados, mas o link não foi atualizado. Veja a mensagem acima.', links && !links.pendentes.length ? '#12857f' : '#b00020');
  } catch (e) {
    escrever('Erro: ' + e.message, '#b00020');
  } finally {
    espelhar(false);
  }
})();
