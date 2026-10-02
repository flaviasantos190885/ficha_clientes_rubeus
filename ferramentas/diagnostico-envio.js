(function () {
  var out = [];
  var botoes = document.querySelectorAll('button, input[type="submit"]');
  botoes.forEach(function (b) {
    out.push('BOTAO "' + (b.textContent || b.value).trim() + '" disabled=' + b.disabled + ' class=' + b.className);
  });
  document.querySelectorAll('input, select, textarea').forEach(function (el) {
    if (/hidden|submit|button/.test(el.type)) return;
    var linha = el.closest('.fc-linha');
    var oculto = !el.offsetParent;
    var invalido = !el.checkValidity();
    var erroTxt = linha ? Array.prototype.map.call(linha.querySelectorAll('[class*="error"], [class*="erro"], [class*="invalid"]'), function (e) { return e.textContent.trim(); }).filter(Boolean).join(' | ') : '';
    var classes = String(el.className);
    var rotulo = linha && linha.querySelector('.fc-rotulo');
    var obrigatorioRotulo = rotulo ? /\*/.test(rotulo.textContent) : false;
    if (/invalid/.test(classes) || ((el.required || obrigatorioRotulo) && !/(^|\s)valid(\s|$)/.test(classes))) {
      out.push('RUBEUS ' + el.name + ' | classes="' + classes + '" | valor="' + String(el.value).slice(0, 40) + '"');
    }
    if (invalido || erroTxt || (oculto && el.required && !el.value)) {
      out.push('CAMPO ' + el.name + ' | oculto=' + oculto + ' | obrigatorio=' + el.required + ' | invalido=' + invalido +
        ' (' + el.validationMessage + ') | valor="' + String(el.value).slice(0, 60) + '" | erro="' + erroTxt + '"');
    }
  });
  var txt = out.join('\n') || 'Nenhum problema encontrado nos campos.';
  try { copy(txt); console.log('Diagnóstico copiado:\n' + txt); } catch (e) { console.log(txt); }
})();
