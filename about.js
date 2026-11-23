/* ============================================================
   CHI SIAMO — animazioni della pagina
   1. Scroll fluido, menu, header, colore che cambia (come la home)
   2. Titoli: parole che salgono · etichette che si decodificano
   3. Apertura: titolo semplice, le parole salgono una alla volta
   5. Foto che si scoprono a quadrati viola
   6. Lo studio: il testo si accende parola per parola
   7. Persone: schede ferme (solo zoom leggero al passaggio del mouse)
   8. Fascia cinetica
   ============================================================ */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HOVER = matchMedia("(hover: hover)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const PRIMARY = "#7b2cff", LIME = "#c6ff3d", DARK = "#0d0b09"; // ✏️ colori dei quadrati
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  $("#year").textContent = new Date().getFullYear();

  /* ---------- 1. SCROLL FLUIDO, MENU, HEADER ---------- */
  let lenis = null;
  if (window.Lenis && !RM) lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });

  const menu = $("#menu"), menuBtn = $("#menu-btn");
  const setMenu = (open) => {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Chiudi" : "Menu";
    document.body.style.overflow = open ? "hidden" : "";
    open ? lenis?.stop() : lenis?.start();
  };
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
  // il link a questa stessa pagina chiude solo il menu
  $$('.menu a[aria-current="page"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); setMenu(false); }));

  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" || id === "#" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (menu.classList.contains("is-open")) setMenu(false);
    if (lenis) lenis.scrollTo(target, { offset: -40, duration: 1.6 });
    else (target === 0 ? document.body : target).scrollIntoView({ behavior: "smooth" });
  }));

  const header = $("#header"), progress = $("#progress");
  const themed = $$("[data-theme]");
  const onScroll = () => {
    header.classList.toggle("is-scrolled", scrollY > 40);
    const mid = innerHeight * 0.5;
    const cur = themed.find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
    if (cur) document.documentElement.classList.toggle("theme-light", cur.dataset.theme === "light");
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- 2. TITOLI E ETICHETTE ---------- */
  // divide un testo in parole che salgono (stessa animazione della home)
  const splitWords = (el, step = 50) => {
    let i = 0;
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(" ");
          const w = document.createElement("span"); w.className = "w";
          const s = document.createElement("span"); s.textContent = part;
          s.style.transitionDelay = `${i++ * step}ms`;
          w.append(s); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(el);
    el.classList.add("split-words");
  };
  $$(".ed h2").forEach((h) => splitWords(h, 55));

  // nome gigante nel footer: lettere che salgono
  const footMark = $(".ed-footer__mark");
  if (footMark) footMark.innerHTML = [...footMark.textContent].map((ch, i) =>
    `<span style="transition-delay:${i * 45}ms">${ch === " " ? "&nbsp;" : ch}</span>`).join("");

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }), { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 90}ms`; io.observe(el); });
  $$(".ed .split-words, .ed-footer__mark").forEach((el) => io.observe(el));

  // etichette che si "decodificano" (lettere casuali → testo)
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>";
  const scramble = (el) => {
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    if (RM) return;
    const t0 = performance.now(), dur = 700 + final.length * 18;
    const tick = (now) => {
      const p = clamp((now - t0) / dur), solved = Math.floor(p * final.length);
      el.textContent = final.split("").map((c, i) =>
        i < solved || c === " " || c === "[" || c === "]" ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  };
  const sio = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) scramble(e.target); }), { threshold: 0.6 });
  $$("[data-scramble], .ed-label").forEach((el) => sio.observe(el));
  // passando sopra una persona, il nome si ridecodifica
  // (la larghezza del nome resta fissa mentre si decodifica, così la scheda non cambia misura)
  $$(".ab-person").forEach((p) => p.addEventListener("pointerenter", () => {
    const h = $("h3", p);
    if (h._busy) return;
    h._busy = true;
    h.style.width = `${h.getBoundingClientRect().width}px`; h.style.overflow = "hidden";
    scramble(h);
    setTimeout(() => { h.style.width = h.style.overflow = ""; h._busy = false; }, 700 + h.textContent.length * 18 + 60);
  }));

  // numeri che contano
  const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, to = Number(el.dataset.count);
    if (RM) { el.textContent = to; return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / 1400);
      el.textContent = Math.round(ease(p) * to);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach((el) => cio.observe(el));

  /* ---------- 3. APERTURA: titolo semplice, le parole salgono una alla volta ---------- */
  const heroSec = $("#ab-hero"), title = $("#ab-title");
  let wi = 0;
  const wrapTitle = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(" ");
        const m = document.createElement("span"); m.className = "ab-wm";   // maschera
        const w = document.createElement("span"); w.className = "ab-tw";   // parola che sale
        w.style.setProperty("--d", `${wi++ * 70}ms`);
        w.textContent = part;
        m.append(w); frag.append(m);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) wrapTitle(n);
  });
  wrapTitle(title);
  const arriving = document.documentElement.classList.contains("pt-in");
  setTimeout(() => heroSec.classList.add("is-in"), arriving ? 650 : 200);

  /* ---------- 4. SFONDO: CARTINA DELL'ITALIA A PUNTINI ----------
     L'Italia è fatta di puntini su una griglia.
     - il mouse li fa crescere e accendere di viola
     - da Verona partono onde gialle che attraversano la penisola
     - un clic fa partire un'onda dal punto cliccato */
  const mapCanvas = $("#ab-mapfx");
  const mapFx = { draw: () => {}, resize: () => {} };
  if (mapCanvas && window.ITALY_MAP) {
    const M = window.ITALY_MAP;
    const ctx = mapCanvas.getContext("2d");
    const shape = new Path2D(M.d);
    let W = 0, H = 0, dpr = 1, dots = [], gap = 10, ox = 0, oy = 0, sc = 1, vx = 0, vy = 0;
    let mx = -1e4, my = -1e4, smx = -1e4, smy = -1e4;
    const waves = [];
    let lastAuto = 0;
    mapFx.resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = mapCanvas.clientWidth; H = mapCanvas.clientHeight;
      mapCanvas.width = Math.round(W * dpr); mapCanvas.height = Math.round(H * dpr);
      // ✏️ grandezza e posizione della cartina
      const wide = W > 860;
      const mh = wide ? H * 0.96 : Math.min(H * 0.7, W * 0.94 * M.h / M.w);
      sc = mh / M.h;
      const mw = M.w * sc;
      ox = wide ? W - mw - W * 0.06 : (W - mw) / 2;
      oy = wide ? (H - mh) / 2 + H * 0.02 : H * 0.1;
      vx = ox + M.verona[0] * sc; vy = oy + M.verona[1] * sc;
      // griglia di puntini dentro il contorno
      gap = Math.max(7, Math.round(mw / 62));                       // ✏️ distanza tra i puntini
      const test = document.createElement("canvas").getContext("2d");
      test.setTransform(sc, 0, 0, sc, ox, oy);
      dots = [];
      for (let y = oy; y < oy + mh; y += gap)
        for (let x = ox + ((Math.round((y - oy) / gap) % 2) * gap) / 2; x < ox + mw; x += gap)
          if (test.isPointInPath(shape, x, y)) dots.push({ x, y, g: 0 });
    };
    mapFx.draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // il punto del mouse segue con un po' di inerzia
      if (mx > -1e3) {
        if (smx < -1e3) { smx = mx; smy = my; }
        smx += (mx - smx) * 0.18; smy += (my - smy) * 0.18;
      } else { smx = smy = -1e4; }
      // un'onda da Verona ogni 2,6 secondi
      if (now - lastAuto > 2600) { waves.push({ x: vx, y: vy, t: now, c: 1 }); lastAuto = now; }
      while (waves.length && (now - waves[0].t) > 4200) waves.shift();
      const R = 170, base = gap * 0.14;
      for (const d of dots) {
        // vicinanza al mouse
        const dm = Math.hypot(d.x - smx, d.y - smy);
        const k = dm < R ? Math.pow(1 - dm / R, 2) : 0;
        // passaggio delle onde
        let w = 0;
        for (const wv of waves) {
          const r = (now - wv.t) * 0.45, band = gap * 2.6;
          const dd = Math.abs(Math.hypot(d.x - wv.x, d.y - wv.y) - r);
          if (dd < band) w = Math.max(w, (1 - dd / band) * (1 - (now - wv.t) / 4200));
        }
        d.g += (w - d.g) * 0.25;
        const r = base + gap * 0.2 * k + gap * 0.16 * d.g;
        if (d.g > 0.08) ctx.fillStyle = `rgba(198,255,61,${(0.25 + 0.75 * d.g).toFixed(3)})`;
        else if (k > 0.02) ctx.fillStyle = `rgba(${Math.round(255 - 132 * k)},${Math.round(255 - 211 * k)},255,${(0.3 + 0.7 * k).toFixed(3)})`;
        else ctx.fillStyle = "rgba(255,255,255,.32)";
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Verona: puntino giallo con alone che pulsa + nome
      const pulse = (now % 1600) / 1600;
      ctx.strokeStyle = `rgba(198,255,61,${(1 - pulse).toFixed(3)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(vx, vy, gap * 0.6 + pulse * gap * 2.4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#c6ff3d";
      ctx.beginPath(); ctx.arc(vx, vy, gap * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.font = '400 11px "Geist Mono", ui-monospace, monospace';
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.textBaseline = "middle";
      ctx.fillText("VERONA", vx + gap * 3.4, vy);
    };
    heroSec.addEventListener("pointermove", (e) => {
      const r = mapCanvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
    });
    heroSec.addEventListener("pointerleave", () => { mx = my = -1e4; });
    heroSec.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a")) return;
      const r = mapCanvas.getBoundingClientRect();
      waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
    });
    mapFx.resize();
    let mt; addEventListener("resize", () => { clearTimeout(mt); mt = setTimeout(mapFx.resize, 150); });
    if (RM) { mapFx.draw(0); mapFx.draw = () => {}; }
  }

  /* ---------- 5. FOTO: si scoprono a quadrati viola (come nella home) ---------- */
  const tileCovers = [];
  if (!RM) $$(".ab-person").forEach((person, n) => {
    const canvas = $(".ab-person__tiles", person), ctx = canvas.getContext("2d");
    const c = { start: 0, done: false, grid: [], size: 0, w: 0, h: 0 };
    c.draw = () => {
      ctx.clearRect(0, 0, c.w, c.h);
      const d = c.start ? clamp((performance.now() - c.start) / 1500) : 0;
      if (d >= 1) c.done = true;
      c.grid.forEach((g) => {
        const k = clamp((g.t * 1.1 - d * 1.4) * 6 + 1);
        if (k <= 0) return;
        const s = c.size * k + (k >= 1 ? 0.6 : 0);
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x * c.size + (c.size - s) / 2, g.y * c.size + (c.size - s) / 2, s, s);
      });
    };
    c.resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      c.w = canvas.clientWidth; c.h = canvas.clientHeight;
      canvas.width = Math.round(c.w * dpr); canvas.height = Math.round(c.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.size = c.w / 8;                                          // ✏️ 8 quadrati in larghezza
      const cols = Math.ceil(c.w / c.size), rows = Math.ceil(c.h / c.size);
      c.grid = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const r = Math.random();
        c.grid.push({ x, y, t: Math.random() * 0.62 + (1 - y / Math.max(1, rows - 1)) * 0.38, color: r < 0.06 ? LIME : r < 0.15 ? DARK : PRIMARY });
      }
      c.draw();
    };
    const img = $("img", person);
    const tio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      tio.disconnect();
      const go = () => { if (!c.start) c.start = performance.now() + n * 160; };
      !img || img.complete ? go() : img.addEventListener("load", go, { once: true });
      setTimeout(go, 2500);                                      // sicurezza se la foto è lenta
    }), { threshold: 0.3 });
    tio.observe(person);
    c.resize();
    tileCovers.push(c);
  });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => tileCovers.forEach((c) => c.resize()), 150); });

  /* ---------- 6. LO STUDIO: parole che si accendono ---------- */
  const read = $("#ab-read");
  let readWords = [];
  if (read && !RM) {
    read.innerHTML = read.textContent.trim().split(/\s+/).map((w) => `<span class="aw">${w}</span>`).join(" ");
    readWords = $$(".aw", read);
  }
  const updateRead = () => {
    if (!readWords.length) return;
    const r = read.getBoundingClientRect();
    const p = clamp((innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.3));
    const n = p * readWords.length * 1.05;
    readWords.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp(n - i)).toFixed(3); });
  };

  /* ---------- 7. PERSONE ----------
     Le schede restano ferme mentre scorri (niente parallasse: faceva vibrare le foto).
     Quando entrano nello schermo, testo e linee compaiono in sequenza (CSS, una volta sola). */
  const pio = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); pio.unobserve(e.target); }
  }), { threshold: 0.25 });
  $$(".ab-person").forEach((p, i) => { p.style.setProperty("--p", i); pio.observe(p); });

  // bottoni finali "magnetici": seguono leggermente il mouse quando ci passi sopra
  if (HOVER && !RM) $$(".ab-cta .ab-btn").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1)}px)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });

  /* ---------- 7b. ANIMAZIONI DI SCORRIMENTO ----------
     Elementi con data-scroll si muovono mentre scorri:
       out   → il titolo d'apertura sale e svanisce uscendo (la cartina sfuma)
       scale → la frase si ingrandisce e si schiarisce entrando
       rise  → sale dal basso entrando
       left  → scorre da sinistra entrando
     Regole anti-vibrazione: si misura sempre il genitore (che non si muove),
     il movimento è ammorbidito e arrotondato al mezzo pixel, e mai sulle foto. */
  const sfx = $$("[data-scroll]").map((el) => ({ el, type: el.dataset.scroll, v: -1 }));
  const half = (n) => Math.round(n * 2) / 2;
  const updateScrollFx = () => {
    if (RM) return;
    const vh = innerHeight;
    sfx.forEach((o) => {
      const ref = o.el.parentElement.getBoundingClientRect();
      let target;
      if (o.type === "out") target = clamp(-ref.top / (ref.height * 0.75));          // 0 = in cima, 1 = uscito
      else target = clamp((vh - (ref.top + Math.min(ref.height, vh) * 0.15)) / (vh * 0.75)); // 0 = sotto, 1 = arrivato
      if (o.v < 0) o.v = target;
      o.v += (target - o.v) * 0.14;
      if (Math.abs(target - o.v) < 0.0005) o.v = target;
      const e = ease(o.v);
      if (o.type === "out") {
        o.el.style.transform = `translate3d(0,${half(-o.v * 90)}px,0)`;
        o.el.style.opacity = clamp(1 - o.v * 1.15).toFixed(3);
        if (mapCanvas) mapCanvas.style.opacity = heroSec.classList.contains("is-in") ? (1 - o.v * 0.9).toFixed(3) : "";
      } else if (o.type === "scale") {
        o.el.style.transform = `scale(${(0.86 + 0.14 * e).toFixed(4)})`;
        o.el.style.opacity = (0.25 + 0.75 * e).toFixed(3);
      } else if (o.type === "rise") {
        o.el.style.transform = `translate3d(0,${half((1 - e) * 90)}px,0)`;
      } else if (o.type === "left") {
        o.el.style.transform = `translate3d(${half(-(1 - e) * innerWidth * 0.12)}px,0,0)`;
        o.el.style.opacity = (0.2 + 0.8 * e).toFixed(3);
      }
    });
  };

  /* ---------- 8. FASCIA CINETICA ---------- */
  const rows = $$(".mg-band__row");
  let lastY = scrollY, vel = 0, drift = 0;
  const updateBand = (dt) => {
    const dy = scrollY - lastY; lastY = scrollY;
    vel += (dy - vel) * 0.12;
    if (RM) return;
    drift += dt * 0.04;
    rows.forEach((row) => {
      const unit = row.firstElementChild.offsetWidth;
      let x = -((scrollY * 0.45 + drift) % unit);
      if (Number(row.dataset.dir) < 0) x = -unit - x;
      row.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${clamp(vel * -0.12, -12, 12).toFixed(2)}deg)`;
    });
  };

  /* ---------- ciclo unico ---------- */
  let prev = performance.now();
  const loop = (now) => {
    const dt = Math.min(64, now - prev); prev = now;
    lenis?.raf(now);
    if (heroSec.getBoundingClientRect().bottom > 0) mapFx.draw(now);
    updateScrollFx();
    tileCovers.forEach((c) => { if (c.start && !c.done) c.draw(); });
    updateRead();
    updateBand(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
