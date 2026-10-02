(function () {
  var l = document.querySelector('.fc-linha');
  if (!l) { console.log('Nenhuma .fc-linha encontrada: o js/body.js não rodou nesta página.'); return; }
  var c = l.closest('.fc-container');
  var cadeia = [];
  for (var n = c; n && n !== document.body; n = n.parentElement) {
    var cs = getComputedStyle(n);
    cadeia.push(n.tagName.toLowerCase() + '.' + String(n.className).trim().split(/\s+/).join('.') + ' [w=' + n.offsetWidth + ' max=' + cs.maxWidth + ' pad=' + cs.padding + ']');
  }
  var out = 'LINHA:\n' + l.outerHTML + '\n\nCONTAINER ATE BODY:\n' + cadeia.join('\n');
  try { copy(out); console.log('Estrutura copiada (' + out.length + ' caracteres).'); } catch (e) { console.log(out); }
})();
