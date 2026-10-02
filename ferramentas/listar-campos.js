/*
 * Listar campos do formulário Rubeus
 * ----------------------------------
 * Como usar:
 *   1. Abra o formulário em "Pré-visualizar" (ou a URL publicada).
 *   2. F12 > aba Console. Se o formulário estiver dentro de um iframe,
 *      troque o contexto no seletor "top" do Console para o iframe do form.
 *   3. Cole este script inteiro e pressione Enter.
 *   4. O resultado aparece em tabela e o JSON completo é copiado para a
 *      área de transferência (cole aqui na conversa).
 */
(function () {
  var SELETOR = 'input, select, textarea';
  var IGNORAR = ['hidden', 'submit', 'button', 'reset', 'image'];

  function textoLabel(el) {
    if (el.id) {
      var l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) return l.textContent.trim();
    }
    var pai = el.closest('label');
    if (pai) return pai.textContent.trim();
    // sobe até achar um ancestral com texto além do próprio campo
    var n = el.parentElement;
    for (var i = 0; n && i < 5; i++, n = n.parentElement) {
      var lbl = n.querySelector('label, .label, [class*="label"], [class*="titulo"], legend');
      if (lbl && !lbl.contains(el)) return lbl.textContent.trim();
    }
    return el.getAttribute('placeholder') || el.getAttribute('aria-label') || '';
  }

  function cadeiaClasses(el) {
    var out = [];
    var n = el.parentElement;
    for (var i = 0; n && n !== document.body && i < 6; i++, n = n.parentElement) {
      out.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
        (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''));
    }
    return out.join(' < ');
  }

  var vistos = {};
  var campos = [];
  document.querySelectorAll(SELETOR).forEach(function (el) {
    var tipo = (el.type || el.tagName).toLowerCase();
    if (IGNORAR.indexOf(tipo) !== -1) return;
    var chave = (tipo === 'radio' || tipo === 'checkbox') && el.name ? tipo + ':' + el.name : null;
    if (chave && vistos[chave]) { vistos[chave].opcoes.push(el.value); return; }
    var c = {
      label: textoLabel(el),
      name: el.name || '',
      id: el.id || '',
      tipo: tipo,
      obrigatorio: el.required || el.getAttribute('aria-required') === 'true',
      placeholder: el.getAttribute('placeholder') || '',
      opcoes: el.tagName === 'SELECT'
        ? Array.prototype.map.call(el.options, function (o) { return o.text; })
        : (chave ? [el.value] : []),
      classes: el.className || '',
      ancestrais: cadeiaClasses(el)
    };
    if (chave) vistos[chave] = c;
    campos.push(c);
  });

  console.table(campos.map(function (c) {
    return { label: c.label, name: c.name, id: c.id, tipo: c.tipo, obrigatorio: c.obrigatorio };
  }));
  var json = JSON.stringify({ url: location.href, total: campos.length, campos: campos }, null, 2);
  try { copy(json); console.log('JSON copiado para a área de transferência (' + campos.length + ' campos).'); }
  catch (e) { console.log(json); }
})();
