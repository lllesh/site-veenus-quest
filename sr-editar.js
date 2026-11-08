/* Swiss Reduce 1 — editar textos, fotos e vídeos direto na página. Tudo salvo no Supabase (com histórico). */
(function () {
  var LS = 'sr1-chave';
  var CHAVE = null; try { CHAVE = localStorage.getItem(LS) } catch (e) {}
  var SAVED = {}, PEND = {}, pronto = false, podeEditar = false, editando = false;
  try { editando = localStorage.getItem('sr1-modo') === 'on' } catch (e) {}
  var TEXTO = 'h1,h2,h3,h4,h5,h6,p,li,blockquote';

  var st = document.createElement('style');
  st.textContent =
    '.sr-on .sr-ed{outline:none;cursor:text;transition:box-shadow .2s}' +
    '.sr-on .sr-ed:hover{box-shadow:0 0 0 1px rgba(172,0,0,.6);border-radius:4px}' +
    '.sr-on .sr-ed:focus{box-shadow:0 0 0 2px #AC0000;border-radius:4px}' +
    '#sr-status{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;gap:12px;padding:0;border:0;background:none;cursor:pointer;font:700 12px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase}' +
    '#sr-status b{display:block;padding:14px 20px;border-radius:999px;border:0;background:#000;color:#FFFBF3;box-shadow:0 6px 20px rgba(0,0,0,.18)}#sr-status.off b{background:#000;color:#FFFBF3}#sr-status i{font-style:normal;font-weight:600;font-size:10px;letter-spacing:.16em;padding:8px 12px;border-radius:999px;background:#000;color:#FFFBF3;box-shadow:0 2px 10px rgba(0,0,0,.12)}#sr-status.off i,#sr-status i:empty{display:none}#sr-status[hidden]{display:none}' +
    '#sr-troca{position:fixed;z-index:2147483001;font:600 11px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;padding:12px 16px;border:0;border-radius:999px;background:#AC0000;color:#FFFBF3;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}#sr-troca[hidden]{display:none}';
  document.head.appendChild(st);

  var badge = document.createElement('button'); badge.id = 'sr-status'; badge.type = 'button'; badge.hidden = true;
  var troca = document.createElement('button'); troca.id = 'sr-troca'; troca.type = 'button'; troca.hidden = true;
  var arquivo = document.createElement('input'); arquivo.type = 'file'; arquivo.hidden = true;
  var msg = 'salvo', cls = '';
  function status(t, c) { if (!podeEditar) return; msg = t; cls = c || ''; mostra() }
  function mostra() { badge.hidden = false; badge.className = editando ? '' : 'off'; badge.innerHTML = ''; var b = document.createElement('b'); b.textContent = editando ? 'edição ON' : 'edição OFF'; var i = document.createElement('i'); i.textContent = msg; badge.appendChild(b); badge.appendChild(i); badge.title = editando ? 'toque pra desligar a edição e navegar' : 'toque pra ligar a edição' }

  // chave de cada coisa = o conteúdo original dela (assim a edição volta mesmo quando o Framer redesenha a página)
  function chaveTexto(t) { t = t.replace(/\s+/g, ' ').trim(); var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return 't:' + t.slice(0, 60) + '#' + (h >>> 0).toString(36) }
  function idMidia(src) { var m = /\/(images|assets)\/([A-Za-z0-9_-]+)\.[a-z0-9]+/i.exec(src || ''); return m ? m[2] : null }

  function textos() {
    var out = [];
    document.querySelectorAll(TEXTO).forEach(function (e) {
      if (e.closest('#sr-status,#sr-troca')) return;
      if (e.querySelector(TEXTO)) return;
      if (!e.__orig) { var t = e.textContent; if (!t.trim() || /^\s*\d+\s*%\s*$/.test(t)) return; e.__orig = t; e.__key = chaveTexto(t) }
      out.push(e);
    });
    return out;
  }
  // texto que o template deixa sem clique (ex.: o "Studio" do topo) volta a aceitar clique na edição, se estiver visível
  function visivel(e) {
    var x = e, op = 1;
    while (x && x !== document.body) { var cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; op *= parseFloat(cs.opacity); x = x.parentElement }
    if (op < 0.5) return false;
    var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function aplicaTexto(e) {
    if (!e.__pronto) {
      e.__pronto = 1; e.classList.add('sr-ed');
      e.addEventListener('input', function () { PEND[e.__key] = e.innerText; agenda() });
      e.addEventListener('paste', function (ev) { if (!e.isContentEditable) return; ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text/plain')) });
    }
    var quer = podeEditar && editando;
    var pe = quer && visivel(e) ? 'auto' : '';
    if (e.style.pointerEvents !== pe) { e.__self = 1; e.style.pointerEvents = pe; e.__self = 0 }
    if (quer && !e.isContentEditable) { e.setAttribute('contenteditable', 'plaintext-only'); if (e.contentEditable !== 'plaintext-only') e.setAttribute('contenteditable', 'true'); e.spellcheck = true }
    if (!quer && e.hasAttribute('contenteditable')) e.removeAttribute('contenteditable');
    if (document.activeElement === e) return;
    var alvo = SAVED[e.__key];
    if (alvo != null && e.innerText !== alvo && !(e.__alvo === alvo && e.textContent === e.__txt)) { e.__self = 1; e.innerText = alvo; e.__alvo = alvo; e.__txt = e.textContent; e.__self = 0 }
  }
  function aplicaMidia() {
    document.querySelectorAll('img').forEach(function (i) {
      if (!i.__id) { i.__id = idMidia(i.getAttribute('src')); if (!i.__id) return }
      var novo = SAVED['i:' + i.__id];
      if (novo && i.getAttribute('src') !== novo) { i.removeAttribute('srcset'); i.removeAttribute('sizes'); i.src = novo }
    });
    document.querySelectorAll('video').forEach(function (v) {
      var s = v.getAttribute('src') || (v.querySelector('source') || {}).src;
      if (!v.__id) { v.__id = idMidia(s); if (!v.__id) return }
      var novo = SAVED['v:' + v.__id];
      if (novo && v.getAttribute('src') !== novo) { v.querySelectorAll('source').forEach(function (x) { x.remove() }); v.src = novo; v.load(); if (v.autoplay) v.play().catch(function () {}) }
    });
  }
  // o nome na aba do navegador acompanha os textos trocados (ex.: "Prince" vira o nome novo do projeto)
  var ORIG = {}, tituloOrig = null, tituloFeito = null;
  function aplicaTitulo() {
    var atual = document.title;
    if (atual !== tituloFeito) tituloOrig = atual;
    var t = tituloOrig || '';
    Object.keys(ORIG).sort(function (a, b) { return b.length - a.length }).forEach(function (o) {
      var novo = SAVED[ORIG[o]]; if (novo == null || o.length < 3) return;
      var i = t.indexOf(o); if (i < 0) return;
      var antes = t.charAt(i - 1), depois = t.charAt(i + o.length);
      if ((antes && /[\wÀ-ÿ]/.test(antes)) || (depois && /[\wÀ-ÿ]/.test(depois))) return;
      t = t.slice(0, i) + novo.replace(/\s+/g, ' ').trim() + t.slice(i + o.length);
    });
    tituloFeito = t; if (document.title !== t) document.title = t;
  }
  function tudo() { if (!pronto) return; textos().forEach(function (e) { ORIG[e.__orig.replace(/\s+/g, ' ').trim()] = e.__key; aplicaTexto(e) }); aplicaMidia(); aplicaTitulo() }

  // salvar
  var t = 0;
  function agenda() { status('salvando…', 'salvando'); clearTimeout(t); t = setTimeout(salvar, 900) }
  function salvar() {
    var lista = Object.keys(PEND).map(function (k) { return { chave: k, html: PEND[k] } }); if (!lista.length) return;
    var envio = PEND; PEND = {};
    fetch('/api/textos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-edit-key': CHAVE }, body: JSON.stringify({ blocos: lista }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(function () { Object.assign(SAVED, envio); status('salvo ' + hora(), ''); tudo() })
      .catch(function () { Object.keys(envio).forEach(function (k) { if (!(k in PEND)) PEND[k] = envio[k] }); status('sem conexão · tentando de novo', 'erro'); clearTimeout(t); t = setTimeout(salvar, 4000) });
  }
  function hora() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) }
  addEventListener('beforeunload', function (e) { if (Object.keys(PEND).length) { salvar(); e.preventDefault(); e.returnValue = '' } });
  addEventListener('online', function () { if (Object.keys(PEND).length) salvar() });

  // trocar foto ou vídeo: um botão aparece em cima da foto/vídeo que estiver embaixo do mouse (ou do dedo)
  var alvoMidia = null, escondeT = 0;
  function midiaEm(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) { var e = els[i]; if (e === troca || e === badge) return alvoMidia; if ((e.tagName === 'IMG' || e.tagName === 'VIDEO') && e.__id) return e }
    return null;
  }
  function posiciona(e) {
    var r = e.getBoundingClientRect(); if (r.width < 40 || r.height < 40) return;
    alvoMidia = e; troca.textContent = e.tagName === 'VIDEO' ? 'trocar vídeo' : 'trocar foto';
    troca.style.left = Math.max(8, r.left + 12) + 'px'; troca.style.top = Math.max(8, r.top + 12) + 'px'; troca.hidden = false;
  }
  function segue(ev) {
    if (!podeEditar || !editando) { troca.hidden = true; return }
    var e = midiaEm(ev.clientX, ev.clientY);
    if (e) { clearTimeout(escondeT); if (e !== troca) posiciona(e) } else { clearTimeout(escondeT); escondeT = setTimeout(function () { troca.hidden = true; alvoMidia = null }, 400) }
  }
  troca.addEventListener('click', function (ev) {
    ev.preventDefault(); ev.stopPropagation(); if (!alvoMidia) return;
    arquivo.accept = alvoMidia.tagName === 'VIDEO' ? 'video/*' : 'image/*'; arquivo.__alvo = alvoMidia; arquivo.value = ''; arquivo.click();
  });
  arquivo.addEventListener('change', function () {
    var f = arquivo.files && arquivo.files[0], e = arquivo.__alvo; if (!f || !e) return;
    var video = e.tagName === 'VIDEO', chave = (video ? 'v:' : 'i:') + e.__id;
    status(video ? 'enviando vídeo…' : 'enviando foto…', 'salvando');
    (video ? Promise.resolve(f) : reduz(f)).then(function (blob) {
      var ext = video ? ((f.name.split('.').pop() || 'mp4').toLowerCase()) : 'jpg';
      return fetch('/api/upload?tipo=' + (video ? 'video' : 'foto') + '&ext=' + ext, { method: 'POST', headers: { 'x-edit-key': CHAVE } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json() })
        .then(function (j) { return fetch(j.envio, { method: 'PUT', headers: { 'Content-Type': blob.type || (video ? 'video/mp4' : 'image/jpeg') }, body: blob }).then(function (r) { if (!r.ok) throw new Error(r.status); return j.url }) });
    }).then(function (url) { PEND[chave] = url; SAVED[chave] = url; aplicaMidia(); salvar() })
      .catch(function () { status(video ? 'o vídeo não foi · tenta de novo' : 'a foto não foi · tenta de novo', 'erro') });
  });
  function reduz(f) {
    return new Promise(function (ok) {
      if (!/^image\/(jpeg|png|webp)/.test(f.type)) return ok(f);
      var img = new Image(); img.onload = function () {
        var max = 2600, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { ok(b || f) }, 'image/jpeg', 0.9); URL.revokeObjectURL(img.src);
      }; img.onerror = function () { ok(f) }; img.src = URL.createObjectURL(f);
    });
  }

  // no modo editar nada abre: links, menu, cards e botões do site ficam parados. só escrever e trocar foto/vídeo funcionam.
  function nosso(t) { return t && t.closest && t.closest('#sr-status,#sr-troca') }
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick', 'auxclick', 'submit'].forEach(function (tipo) {
    window.addEventListener(tipo, function (ev) {
      if (!podeEditar || !editando || nosso(ev.target) || ev.target === arquivo) return;
      if (tipo === 'click' || tipo === 'dblclick' || tipo === 'auxclick' || tipo === 'submit') ev.preventDefault();
      if (tipo === 'pointerdown') segue(ev);
      if (tipo === 'pointerdown' && !(ev.target.closest && ev.target.closest('.sr-ed'))) {
        // clique caiu numa camada transparente por cima do texto: atravessa e abre o texto de baixo pra editar
        var baixo = document.elementsFromPoint(ev.clientX, ev.clientY).filter(function (x) { return x.classList && x.classList.contains('sr-ed') && visivel(x) })[0];
        if (baixo) {
          ev.preventDefault();
          setTimeout(function () { baixo.focus(); var r = document.createRange(); r.selectNodeContents(baixo); r.collapse(false); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r) }, 0);
        }
      }
      ev.stopPropagation();
    }, { capture: true });
  });
  window.addEventListener('keydown', function (ev) {
    if (!podeEditar || !editando || nosso(ev.target)) return;
    var el = ev.target; if (ev.key === 'Enter' && el && !el.isContentEditable && el.closest && el.closest('a,button,[role=button]')) { ev.preventDefault(); ev.stopPropagation() }
  }, { capture: true });
  badge.addEventListener('click', function () { editando = !editando; try { localStorage.setItem('sr1-modo', editando ? 'on' : 'off') } catch (e) {} if (!editando) { troca.hidden = true; if (document.activeElement && document.activeElement.blur) document.activeElement.blur() } document.documentElement.classList.toggle('sr-on', editando); mostra(); tudo() });

  function iniciar() {
    document.body.appendChild(badge); document.body.appendChild(troca); document.body.appendChild(arquivo);
    var chk = CHAVE ? fetch('/api/textos?check=1', { headers: { 'x-edit-key': CHAVE } }).then(function (r) { return r.json() }).then(function (j) { podeEditar = !!j.ok }).catch(function () {}) : Promise.resolve();
    var load = (window.__srTextos || fetch('/api/textos').then(function (r) { return r.json() })).then(function (rows) { (rows || []).forEach(function (r) { SAVED[r.chave] = r.html }) }).catch(function () {});
    Promise.all([chk, load, depoisDoFramer()]).then(function () {
      pronto = true;
      if (podeEditar) { document.documentElement.classList.toggle('sr-on', editando); status('salvo', ''); addEventListener('pointermove', segue, { passive: true }); addEventListener('pointerdown', segue, { passive: true }); addEventListener('scroll', function () { if (alvoMidia && !troca.hidden) posiciona(alvoMidia) }, { passive: true }); setInterval(function () { if (editando) textos().forEach(aplicaTexto) }, 800) }
      tudo(); setTimeout(tudo, 600); setTimeout(tudo, 2000); mostraPagina();
      var tt = document.querySelector('title'); if (tt) new MutationObserver(function () { if (document.title !== tituloFeito) aplicaTitulo() }).observe(tt, { childList: true, characterData: true, subtree: true });
      new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var x = ms[i].target; if (x.__self || (x.parentElement && x.parentElement.__self)) continue; clearTimeout(iniciar.__m); iniciar.__m = setTimeout(tudo, 120); return } }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
    });
  }
  // espera o Framer terminar de montar a página (ele tira as versões de tela que não servem). Mexer antes disso faz ele redesenhar com os nomes antigos
  function depoisDoFramer() { return window.__srFramer || Promise.resolve() }
  // a página fica escondida até os textos novos entrarem (nunca aparece o nome antigo). E sempre que o Framer redesenhar, o texto é corrigido antes de pintar a tela
  function mostraPagina() {
    var h = document.documentElement;
    var mo = new MutationObserver(function () { tudo(); mo.takeRecords() });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    requestAnimationFrame(function () { tudo(); h.classList.remove('sr-espera') });
  }
  if (document.readyState !== 'loading') iniciar(); else addEventListener('DOMContentLoaded', iniciar);
})();
