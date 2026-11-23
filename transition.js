/* ============================================================
   CAMBIO PAGINA A QUADRATI
   Cliccando un link verso un'altra pagina del sito lo schermo si copre
   di quadrati viola; la pagina nuova si apre scoprendosi allo stesso modo.
   ============================================================ */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = "sl-pt";
  const PRIMARY = "#7b2cff", LIME = "#c6ff3d";
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  const c = document.createElement("canvas");
  c.className = "pt"; c.setAttribute("aria-hidden", "true");
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  let W = 0, H = 0, size = 0, tiles = [];
  const build = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    c.width = W * d; c.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    size = Math.max(W, H) / (W < 700 ? 9 : 16);           // ✏️ dimensione dei quadrati
    const cols = Math.ceil(W / size), rows = Math.ceil(H / size);
    tiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      // ondata da sinistra a destra, con un po' di casualità
      tiles.push({ x: x * size, y: y * size, t: Math.random() * 0.5 + (x / cols) * 0.5, lime: Math.random() < 0.05 });
  };
  // dir 1 = copre, dir -1 = scopre
  const draw = (p, dir) => {
    ctx.clearRect(0, 0, W, H);
    tiles.forEach((tl) => {
      const local = ease(clamp((p - tl.t * 0.6) / 0.4));
      const k = dir > 0 ? local : 1 - local;
      if (k <= 0.001) return;
      const s = size * k + 0.6;
      ctx.fillStyle = tl.lime && k > 0.2 && k < 0.8 ? LIME : PRIMARY;
      ctx.fillRect(tl.x + (size - s) / 2, tl.y + (size - s) / 2, s, s);
    });
  };
  const run = (dir, dur, done) => {
    const t0 = performance.now();
    const frame = (now) => {
      const p = clamp((now - t0) / dur);
      draw(p, dir);
      if (p < 1) requestAnimationFrame(frame); else done && done();
    };
    requestAnimationFrame(frame);
  };

  // arrivo da un'altra pagina: si parte coperti e ci si scopre
  let arrived = false;
  try { arrived = !!sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
  if (arrived) {
    build(); draw(0, -1);
    document.documentElement.classList.remove("pt-in");
    if (RM) ctx.clearRect(0, 0, W, H);
    else setTimeout(() => run(-1, 950), 60);
  }

  // partenza: copre lo schermo e poi cambia pagina
  const samePage = (url) => url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || samePage(url)) return;
    e.preventDefault();
    try { sessionStorage.setItem(KEY, "1"); } catch (err) {}
    if (RM) { location.href = url.href; return; }
    build();
    run(1, 750, () => { location.href = url.href; });
  });

  // tornando indietro col browser la pagina può essere ancora coperta: la puliamo
  addEventListener("pageshow", (e) => { if (e.persisted) { ctx.clearRect(0, 0, W, H); document.documentElement.classList.remove("pt-in"); } });
})();
