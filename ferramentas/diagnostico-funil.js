(function () {
  function limpar(u) {
    try {
      var url = new URL(u, location.href);
      url.searchParams.forEach(function (v, k) { if (/token|key|auth|senha|pass/i.test(k)) url.searchParams.set(k, 'X'); });
      return url.pathname + (url.search ? url.search.replace(/\d{6,}/g, 'N') : '');
    } catch (e) { return String(u).slice(0, 200); }
  }
  function modelo(t) { return String(t).replace(/\d+/g, 'N'); }

  var requisicoes = {};
  performance.getEntriesByType('resource').forEach(function (r) {
    if (['xmlhttprequest', 'fetch'].indexOf(r.initiatorType) === -1) return;
    var k = r.initiatorType + ' ' + limpar(r.name);
    requisicoes[k] = (requisicoes[k] || 0) + 1;
  });

  var links = {};
  document.querySelectorAll('a[href]').forEach(function (a) {
    var h = a.getAttribute('href');
    if (!/\d{3,}/.test(h)) return;
    var k = modelo(h);
    if (!links[k]) links[k] = { quantidade: 0, exemplo: h };
    links[k].quantidade++;
  });

  var atributos = {};
  document.querySelectorAll('*').forEach(function (el) {
    Array.from(el.attributes || []).forEach(function (at) {
      if (!/^(data-|id$|ng-reflect)/.test(at.name) || !/\d{3,}/.test(at.value)) return;
      var k = el.tagName.toLowerCase() + '[' + at.name + ']';
      if (!atributos[k]) atributos[k] = { quantidade: 0, exemplo: at.value.slice(0, 80) };
      atributos[k].quantidade++;
    });
  });

  var cartoes = [];
  var candidatos = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="registro"], [class*="item"], tr');
  for (var i = 0; i < candidatos.length && cartoes.length < 3; i++) {
    var t = (candidatos[i].innerText || '').trim().replace(/\s+/g, ' ');
    if (t.length > 10 && t.length < 400) cartoes.push({ classe: candidatos[i].className && String(candidatos[i].className).slice(0, 120), html: candidatos[i].outerHTML.replace(/\s+/g, ' ').slice(0, 700) });
  }

  var resultado = { pagina: limpar(location.href), requisicoes: requisicoes, links: links, atributos: atributos, cartoes: cartoes, globais: Object.keys(window).filter(function (k) { return /angular|ng|app|store|redux|vue/i.test(k); }).slice(0, 30) };
  var json = JSON.stringify(resultado, null, 1);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'diagnostico-funil.json';
  a.click();
  console.log('Diagnóstico baixado (diagnostico-funil.json). Requisições: ' + Object.keys(requisicoes).length + ' | modelos de link: ' + Object.keys(links).length);
})();
