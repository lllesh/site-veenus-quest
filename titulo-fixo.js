/* O título gigante não some: quando ele sai da tela, uma cópia menor, com as mesmas cores, fica fixa no alto
   enquanto o texto acende. window.srTopo() diz onde o texto parado pode começar, abaixo do título. */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.titulo-fixo{position:fixed;left:0;right:0;z-index:15;pointer-events:none;opacity:0;transform:translateY(-12px);transition:opacity .35s ease,transform .35s ease;background:linear-gradient(var(--bg,#FBFAF8) 78%,transparent)}' +
    '.titulo-fixo.on{opacity:1;transform:none}' +
    '.titulo-fixo .wrap{padding-block:14px 22px}' +
    '.titulo-fixo .tf{margin:0;font-weight:900;font-size:clamp(40px,6.5vw,92px);line-height:.9;letter-spacing:-.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.titulo-fixo .tf span{display:inline-block}' +
    '@media (prefers-reduced-motion:reduce){.titulo-fixo{transition:none}}';
  document.head.appendChild(st);

  var f, tf, h1, nav, visivel = true;
  function navBaixo() { if (!nav) return 0; var r = nav.getBoundingClientRect(); return r.bottom > 0 ? r.bottom : 0 }
  function posiciona() { if (f) f.style.top = navBaixo() + 'px' }
  function copia() {
    if (!tf || !h1) return;
    tf.textContent = '';
    // página que pede o título fixo do mesmo tamanho do grande (window.SR_TITULO_IGUAL)
    if (window.SR_TITULO_IGUAL) { var cs = getComputedStyle(h1); tf.style.fontSize = cs.fontSize; tf.style.lineHeight = cs.lineHeight; tf.style.letterSpacing = cs.letterSpacing; tf.style.whiteSpace = 'normal'; tf.style.overflow = 'visible' }
    [].forEach.call(h1.childNodes, function (n) {
      if (n.nodeName === 'BR') { if (window.SR_TITULO_IGUAL) tf.appendChild(document.createElement('br')); return }
      if (n.nodeType === 3) { var t = document.createElement('span'); t.textContent = n.textContent; t.style.color = getComputedStyle(h1).color; t.style.display = 'inline'; tf.appendChild(t); return }
      var s = document.createElement('span'); s.textContent = n.textContent;
      s.style.color = getComputedStyle(n).color; if (n.style && n.style.width) s.style.width = n.style.width;
      tf.appendChild(s);
    });
  }
  function mostra() {
    if (!f) return;
    var r = h1.getBoundingClientRect(), fora = r.bottom < navBaixo() + 10;
    f.classList.toggle('on', fora); posiciona();
  }
  window.srTopo = function () { if (!f) return 90; posiciona(); return navBaixo() + f.offsetHeight + 16 };
  window.srTituloFixo = function () {
    h1 = document.querySelector('.abre h1'); if (!h1) return;
    nav = document.querySelector('nav.topo, nav.paginas');
    if (!f) {
      f = document.createElement('div'); f.className = 'titulo-fixo'; f.setAttribute('aria-hidden', 'true');
      var w = document.createElement('div'); w.className = 'wrap'; tf = document.createElement('p'); tf.className = 'tf';
      w.appendChild(tf); f.appendChild(w); document.body.appendChild(f);
      addEventListener('scroll', mostra, { passive: true }); addEventListener('resize', function () { copia(); mostra() });
    }
    copia(); mostra();
  };
  window.srTituloFixo.copia = function () { copia(); mostra() };
})();
