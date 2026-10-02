(function () {
  console.log('Clique no campo Cidade/Estado e digite "Muri" agora. Captura em 6 segundos...');
  setTimeout(function () {
    var c = document.querySelector('[name="pessoa.cidade"]');
    var linha = c && (c.closest('.fc-linha') || c.parentElement.parentElement);
    var visiveis = [];
    document.querySelectorAll('body *').forEach(function (e) {
      if (e.offsetParent && /muri/i.test(e.textContent) && e.children.length === 0 && !e.closest('.fc-bloco')) {
        var cad = [];
        for (var n = e; n && n !== document.body && cad.length < 5; n = n.parentElement) cad.push(n.tagName.toLowerCase() + '.' + String(n.className).trim().split(/\s+/).join('.'));
        visiveis.push(e.textContent.trim() + '  <=  ' + cad.join(' < '));
      }
    });
    var out = 'VALOR: ' + (c && c.value) + '\nATRIBUTOS: ' + (c ? Array.prototype.map.call(c.attributes, function (a) { return a.name + '=' + a.value; }).join(' | ') : '') +
      '\n\nITENS VISIVEIS COM "MURI":\n' + visiveis.slice(0, 15).join('\n') + '\n\nLINHA:\n' + (linha ? linha.outerHTML.slice(0, 3000) : '');
    try { copy(out); console.log('Copiado:\n' + out); } catch (e) { console.log(out); }
  }, 6000);
})();
