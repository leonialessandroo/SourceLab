/* ============================================================
   MOTION — animazioni delle sezioni ispirate a Monogrid
   (codice nostro, scritto da zero)
   1. Etichette che si "decodificano" (lettere casuali → testo)
   2. Manifesto: parole che si accendono + allagamento viola
   3. Cosa facciamo: immagini che volano, rese a pixel viola in WebGL;
      il mouse lascia una scia che le rivela a colori e le deforma
   4. Fascia cinetica: testo che scorre e si inclina con lo scroll
   ============================================================ */
(() => {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  // avanzamento 0→1 di una sezione "bloccata" (da quando arriva in cima a quando finisce)
  const progressOf = (el) => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight));
  };

  /* ---------- 1. ETICHETTE CHE SI DECODIFICANO ---------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>";
  const scramble = (el) => {
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    if (RM) return;
    const t0 = performance.now(), dur = 700 + final.length * 18;
    const tick = (now) => {
      const p = clamp((now - t0) / dur);
      const solved = Math.floor(p * final.length);
      el.textContent = final.split("").map((c, i) =>
        i < solved || c === " " || c === "[" || c === "]" ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  };
  const scrambleIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) scramble(e.target); });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-scramble], .ed-label").forEach((el) => scrambleIO.observe(el));

  /* ---------- 2. MANIFESTO ---------- */
  const manifesto = document.getElementById("manifesto");
  const words = document.getElementById("mg-words");
  let wordEls = [];
  if (words) {
    words.innerHTML = words.textContent.trim().split(/\s+/)
      .map((w) => `<span class="w">${w}</span>`).join(" ");
    wordEls = [...words.querySelectorAll(".w")];
  }
  const flood = manifesto && manifesto.querySelector(".mg-flood");
  const count = document.getElementById("mg-count");
  const fadeEls = manifesto ? [...manifesto.querySelectorAll(".mg-label, .mg-words, .mg-meter")] : [];
  const updateManifesto = () => {
    if (!manifesto || RM) return;
    const p = progressOf(manifesto);
    // 1) le parole si accendono (4% → 44% dello scroll)
    const wp = clamp((p - 0.04) / 0.4) * wordEls.length;
    wordEls.forEach((w, i) => { w.style.opacity = (0.13 + 0.87 * clamp(wp - i)).toFixed(3); });
    // 2) lo schermo si allaga di viola (44% → 60%)
    const f = ease(clamp((p - 0.44) / 0.16));
    flood.style.clipPath = `circle(${(f * 150).toFixed(2)}% at 50% 58%)`;
    manifesto.classList.toggle("is-flooded", f > 0.3);
    // 3) il viola diventa una griglia di quadrati che spariscono (62% → 94%):
    //    dai buchi si vede la sezione successiva, già pronta sotto
    const open = f >= 0.999;
    manifesto.classList.toggle("is-open", open);
    const d = open ? clamp((p - 0.62) / 0.32) : -1;
    drawTiles(d);
    const textOp = 1 - clamp(d / 0.35);
    fadeEls.forEach((el) => { el.style.opacity = textOp.toFixed(3); });
    count.textContent = String(Math.round(p * 100)).padStart(3, "0");
  };

  /* ---------- 3. COSA FACCIAMO: immagini volanti ---------- */
  const services = document.getElementById("servizi");
  const flyers = [...document.querySelectorAll(".mg-fly")];
  const list = [...document.querySelectorAll("#mg-list li")];
  flyers.forEach((f) => f.style.setProperty("--img", `url('${f.dataset.src}')`));
  const updateServices = () => {
    if (!services) return;
    const p = RM ? 0.5 : progressOf(services);
    const H = innerHeight;
    flyers.forEach((f) => {
      // ogni immagine sale dal fondo verso l'alto a una velocità diversa
      const t = p * 1.6 * Number(f.dataset.speed) - Number(f.dataset.offset) * 0.9;
      const y = H * 1.05 - t * H * 1.9;
      f.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
    const idx = Math.min(list.length - 1, Math.floor(clamp((p - 0.3) / 0.62) * list.length));
    list.forEach((li, i) => li.classList.toggle("is-on", i === idx));
  };

  /* ---------- 3b. TRANSIZIONE A QUADRATI ----------
     Alla fine del manifesto il viola si rompe in grandi quadrati che spariscono
     in ordine casuale; da sotto appare "Cosa facciamo" (vedi margin-top in motion.css). */
  const tiles = document.getElementById("mg-tiles");
  const tctx = tiles && tiles.getContext("2d");
  let grid = [], tCols = 0, tRows = 0, lastD = -1;
  const TILE_COLOR = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#7b2cff";
  const buildTiles = () => {
    if (!tiles) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    tiles.width = Math.round(tiles.clientWidth * dpr); tiles.height = Math.round(tiles.clientHeight * dpr);
    tCols = innerWidth < 700 ? 6 : 12;                      // ✏️ quanti quadrati in larghezza
    const size = tiles.width / tCols;
    tRows = Math.ceil(tiles.height / size);
    grid = [];
    for (let y = 0; y < tRows; y++) for (let x = 0; x < tCols; x++) {
      // ordine casuale, con una leggera tendenza a partire dal centro
      const dx = x / (tCols - 1) - 0.5, dy = y / Math.max(1, tRows - 1) - 0.5;
      grid.push({ x, y, t: Math.random() * 0.75 + Math.hypot(dx, dy) * 0.35 });
    }
    lastD = -1;
  };
  buildTiles();
  addEventListener("resize", buildTiles);
  // d < 0: nessun quadrato (si vede l'allagamento); 0 = tutto viola; 1 = tutti spariti
  function drawTiles(d) {
    if (!tctx || Math.abs(d - lastD) < 0.001) return;
    lastD = d;
    tctx.clearRect(0, 0, tiles.width, tiles.height);
    if (d < 0 || d >= 1) return;
    const size = tiles.width / tCols;
    tctx.fillStyle = TILE_COLOR;
    grid.forEach((g) => {
      const k = clamp((g.t * 1.1 - d * 1.4) * 6 + 1);      // 1 = pieno, 0 = sparito
      if (k <= 0) return;
      // il quadrato "implode" verso il suo centro prima di sparire
      const s = size * (k < 1 ? 0.35 + 0.65 * k : 1);
      const off = (size - s) / 2;
      tctx.fillRect(Math.floor(g.x * size + off), Math.floor(g.y * size + off), Math.ceil(s) + 1, Math.ceil(s) + 1);
    });
  }

  /* ---------- 5. SHOWREEL (seconda sezione) ----------
     - entra coperto da quadrati viola che si sciolgono mentre il riquadro cresce
     - ogni cambio di concept avviene "a quadrati": coprono, cambia, scoprono
     - il bottone "[ Apri il concept ]" segue il cursore
     - etichetta del concept che si decodifica a ogni cambio */
  const reelBox = document.querySelector(".reelshow");
  const reelWrap = document.getElementById("reel");
  const rCanvas = document.getElementById("reel-tiles");
  const rctx = rCanvas && !RM ? rCanvas.getContext("2d") : null;
  const reelTag = document.getElementById("reel-tag");
  const reelPlay = document.getElementById("reel-play");
  const ACCENT = "#c6ff3d";                                 // ✏️ lime dei quadrati
  let rGrid = [], rSize = 0, reelSwitch = null, reelVisible = false;
  const buildReel = () => {
    if (!rctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    rCanvas.width = Math.round(rCanvas.clientWidth * dpr); rCanvas.height = Math.round(rCanvas.clientHeight * dpr);
    const cols = innerWidth < 700 ? 9 : 18;                 // ✏️ quanti quadrati in larghezza nello showreel
    rSize = rCanvas.width / cols;
    const rws = Math.ceil(rCanvas.height / rSize);
    rGrid = [];
    for (let y = 0; y < rws; y++) for (let x = 0; x < cols; x++) {
      const r = Math.random();
      // quasi tutti viola, qualche quadrato lime e qualcuno scuro per dare ritmo
      rGrid.push({ x, y, a: Math.random(), b: Math.random(), color: r < 0.06 ? ACCENT : r < 0.16 ? "#0d0b09" : TILE_COLOR });
    }
  };
  if (rctx) {
    reelBox.classList.add("has-tiles");
    buildReel();
    addEventListener("resize", buildReel);
    new IntersectionObserver(([e]) => { reelVisible = e.isIntersecting; }, { rootMargin: "60px" }).observe(reelBox);
    window.reelTransition = (swap) => {
      if (!reelVisible || reelSwitch) { swap(); return; }
      reelSwitch = { t0: performance.now(), swap, done: false };
    };
  }
  const rescramble = (el) => { delete el.dataset.text; scramble(el); };
  const drawReel = (now) => {
    if (!rctx || !reelVisible) return;
    const pr = parseFloat(reelWrap.style.getPropertyValue("--p")) || 0;
    const enter = 1 - clamp((pr - 0.12) / 0.6);              // 1 = coperto, 0 = scoperto
    let cov = 0, second = false;
    if (reelSwitch) {
      const u = (now - reelSwitch.t0) / 1000;               // ✏️ durata del cambio: 1 secondo
      if (u >= 0.5 && !reelSwitch.done) {
        reelSwitch.swap(); reelSwitch.done = true;
        rescramble(reelTag); rescramble(reelPlay);
      }
      second = u >= 0.5;
      cov = second ? 1 - (u - 0.5) / 0.5 : u / 0.5;
      if (u >= 1) reelSwitch = null;
    }
    rctx.clearRect(0, 0, rCanvas.width, rCanvas.height);
    rGrid.forEach((g) => {
      const ke = clamp((enter - g.a * 0.8) * 5);
      const ks = reelSwitch ? clamp((cov - (second ? g.b : g.a) * 0.8) * 5) : 0;
      const k = Math.max(ke, ks);
      if (k <= 0) return;
      const sz = rSize * (k < 1 ? 0.3 + 0.7 * k : 1);
      const off = (rSize - sz) / 2;
      rctx.fillStyle = g.color;
      rctx.fillRect(Math.floor(g.x * rSize + off), Math.floor(g.y * rSize + off), Math.ceil(sz) + 1, Math.ceil(sz) + 1);
    });
  };
  // bottone che segue il cursore (solo con il mouse)
  const cursor = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  if (reelBox && matchMedia("(hover: hover)").matches && !RM) {
    reelBox.addEventListener("pointermove", (e) => {
      const r = reelBox.getBoundingClientRect(), k = r.width / reelBox.offsetWidth;
      cursor.tx = (e.clientX - r.left) / k; cursor.ty = (e.clientY - r.top) / k;
      if (!cursor.on) { cursor.x = cursor.tx; cursor.y = cursor.ty; cursor.on = true; reelBox.classList.add("is-follow"); }
    });
    reelBox.addEventListener("pointerleave", () => { cursor.on = false; reelBox.classList.remove("is-follow"); });
  }
  const moveCursor = () => {
    if (!cursor.on) return;
    cursor.x += (cursor.tx - cursor.x) * 0.18; cursor.y += (cursor.ty - cursor.y) * 0.18;
    reelBox.style.setProperty("--cx", cursor.x.toFixed(1) + "px");
    reelBox.style.setProperty("--cy", cursor.y.toFixed(1) + "px");
  };

  /* ---------- 4. FASCIA CINETICA ---------- */
  const rows = [...document.querySelectorAll(".mg-band__row")];
  let lastY = scrollY, vel = 0, drift = 0;
  const updateBand = (dt) => {
    const dy = scrollY - lastY; lastY = scrollY;
    vel += (dy - vel) * 0.12;
    if (RM) return;
    drift += dt * 0.04;
    rows.forEach((row) => {
      const dir = Number(row.dataset.dir);
      const unit = row.firstElementChild.offsetWidth;   // larghezza di una ripetizione
      let x = -((scrollY * 0.45 + drift) % unit);
      if (dir < 0) x = -unit - x;
      const skew = clamp(vel * -0.12, -12, 12);
      row.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    });
  };

  /* ---------- WebGL: dithering viola + scia del cursore ---------- */
  const canvas = document.getElementById("mg-canvas");
  const gl = canvas && canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
  let renderGL = () => {};
  if (!gl) document.documentElement.classList.add("no-webgl");
  else renderGL = setupGL(gl, canvas, services, flyers);

  /* ---------- ciclo unico ---------- */
  let prev = performance.now();
  const loop = (now) => {
    const dt = Math.min(64, now - prev); prev = now;
    updateManifesto();
    updateServices();
    updateBand(dt);
    drawReel(now);
    moveCursor();
    renderGL(now, vel);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  /* ============================================================
     setupGL — tutto il WebGL della sezione "Cosa facciamo"
     ============================================================ */
  function setupGL(gl, canvas, section, flyers) {
    const VERT_FULL = `attribute vec2 aPos; varying vec2 vUv;
      void main(){ vUv = aPos; gl_Position = vec4(aPos*2.0-1.0, 0.0, 1.0); }`;
    const VERT_RECT = `attribute vec2 aPos; uniform vec4 uRect; uniform vec2 uRes; varying vec2 vUv;
      void main(){ vUv = aPos; vec2 px = uRect.xy + aPos*uRect.zw; vec2 c = px/uRes*2.0-1.0; c.y = -c.y;
        gl_Position = vec4(c, 0.0, 1.0); }`;
    // scia: R = intensità, GB = velocità (codificata attorno a 0.5)
    const FRAG_TRAIL = `precision highp float; varying vec2 vUv;
      uniform sampler2D uPrev; uniform vec2 uMouse; uniform vec2 uVel; uniform float uAspect; uniform float uForce;
      void main(){
        vec4 p = texture2D(uPrev, vUv);
        float i = max(0.0, p.r*0.965 - 0.006);
        vec2 v = (p.gb - 0.5); v -= sign(v)*min(abs(v), vec2(0.006)); v *= 0.96;
        vec2 d = vUv - uMouse; d.x *= uAspect;
        float g = exp(-dot(d,d)/0.0028) * uForce;
        i = min(1.0, i + g);
        v = clamp(v + uVel*g, -0.5, 0.5);
        gl_FragColor = vec4(i, v + 0.5, 1.0);
      }`;
    const BAYER = `float bayer(vec2 p){ p = mod(p, 4.0);
        float x = p.x, y = p.y; float v = 0.0;
        if (y < 1.0) v = x<1.0?0.0: x<2.0?8.0: x<3.0?2.0:10.0;
        else if (y < 2.0) v = x<1.0?12.0: x<2.0?4.0: x<3.0?14.0:6.0;
        else if (y < 3.0) v = x<1.0?3.0: x<2.0?11.0: x<3.0?1.0:9.0;
        else v = x<1.0?15.0: x<2.0?7.0: x<3.0?13.0:5.0;
        return (v + 0.5) / 16.0; }`;
    // sfondo: rumore a pixel viola, visibile solo dentro la scia
    const FRAG_BG = `precision highp float; varying vec2 vUv;
      uniform sampler2D uTrail; uniform vec2 uRes; uniform float uTime; uniform float uCell;
      ${BAYER}
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k=0;k<4;k++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec2 cell = floor(gl_FragCoord.xy / uCell);
        vec2 suv = (cell + 0.5) * uCell / uRes;
        float t = texture2D(uTrail, suv).r;
        float n = fbm(suv * vec2(uRes.x/uRes.y, 1.0) * 3.0 + vec2(0.0, uTime*0.06));
        float on = step(bayer(cell), n * t * 1.8);
        gl_FragColor = vec4(0.48, 0.17, 1.0, on * 0.85);
      }`;
    // immagini: pixel viola (dithering a 3 toni); la scia le rivela a colori,
    // le sposta nella direzione del mouse e separa i canali RGB
    const FRAG_IMG = `precision highp float; varying vec2 vUv;
      uniform sampler2D uTex; uniform sampler2D uTrail; uniform vec2 uRes; uniform vec2 uQuad;
      uniform float uImgAr; uniform float uCell; uniform float uReveal; uniform float uTime; uniform float uScroll;
      ${BAYER}
      vec2 cover(vec2 uv){ float qa = uQuad.x/uQuad.y; vec2 s = qa > uImgAr ? vec2(1.0, uImgAr/qa) : vec2(qa/uImgAr, 1.0);
        return (uv - 0.5) * s + 0.5; }
      void main(){
        vec2 frag = gl_FragCoord.xy;
        vec4 tr = texture2D(uTrail, frag / uRes);
        float t = tr.r; vec2 vel = (tr.gb - 0.5) * vec2(1.0, -1.0);
        // entrata: parte a pixel grandi e si "risolve"
        float cell = mix(56.0, uCell, uReveal);
        vec2 snapped = (floor(frag / cell) + 0.5) * cell;
        vec2 uv = vUv + (snapped - frag) / uQuad * vec2(1.0, -1.0);
        uv.x += sin(uv.y * 9.0 + uTime * 2.0) * uScroll * 0.015;   // onda quando scorri veloce
        uv += vel * t * 0.35;                                       // spinta del mouse
        vec2 cuv = cover(clamp(uv, 0.0, 1.0));
        vec3 col = texture2D(uTex, cuv).rgb;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        lum = clamp((lum - 0.08) * 1.35, 0.0, 1.0);
        float q = floor(lum * 2.0 + bayer(floor(frag / cell))) / 2.0;
        vec3 dith = q < 0.25 ? vec3(0.05, 0.03, 0.09) : q < 0.75 ? vec3(0.48, 0.17, 1.0) : vec3(0.85, 0.78, 1.0);
        vec2 sh = vel * 0.06 * t;
        vec3 real = vec3(texture2D(uTex, cover(clamp(uv + sh, 0.0, 1.0))).r, col.g,
                         texture2D(uTex, cover(clamp(uv - sh, 0.0, 1.0))).b);
        float k = smoothstep(0.04, 0.45, t) * step(0.98, uReveal);
        float a = smoothstep(0.0, 0.25, uReveal);
        gl_FragColor = vec4(mix(dith, real, k), a);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s));
      return s;
    };
    const program = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "aPos"); gl.linkProgram(p);
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    };
    const pTrail = program(VERT_FULL, FRAG_TRAIL);
    const pBg = program(VERT_FULL, FRAG_BG);
    const pImg = program(VERT_RECT, FRAG_IMG);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const makeTarget = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0.5, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h };
    };

    // immagini → texture (Unsplash permette l'uso cross-origin)
    const items = flyers.map((el) => {
      const it = { el, tex: null, ar: 1, reveal: 0, inView: false };
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        it.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, it.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        it.ar = img.naturalWidth / img.naturalHeight;
      };
      img.src = el.dataset.src;
      return it;
    });

    let W = 0, H = 0, dpr = 1, trailA, trailB;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
      const tw = Math.max(2, W >> 2), th = Math.max(2, H >> 2);
      trailA = makeTarget(tw, th); trailB = makeTarget(tw, th);
    };
    resize();
    addEventListener("resize", resize);

    // mouse in coordinate 0→1 del canvas (y verso l'alto, come WebGL)
    const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, active: false, last: 0 };
    addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width; mouse.y = 1 - (e.clientY - r.top) / r.height;
      mouse.active = mouse.x >= 0 && mouse.x <= 1 && mouse.y >= 0 && mouse.y <= 1;
      mouse.last = performance.now();
    }, { passive: true });

    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" }).observe(section);

    return (now, scrollVel) => {
      if (!visible) return;
      const time = now / 1000;
      // senza mouse (es. telefono) una scia "fantasma" gira da sola
      let mx = mouse.x, my = mouse.y, force = 0;
      const idle = now - mouse.last > 2200;
      if (idle) {
        mx = 0.5 + Math.sin(time * 0.7) * 0.32 + Math.sin(time * 1.9) * 0.06;
        my = 0.5 + Math.cos(time * 0.9) * 0.28;
        force = 0.35;
      } else if (mouse.active) {
        force = clamp(Math.hypot(mx - mouse.px, my - mouse.py) * 40);
      }
      const vx = clamp((mx - mouse.px) * 6, -0.5, 0.5), vy = clamp((my - mouse.py) * 6, -0.5, 0.5);
      mouse.px = mx; mouse.py = my;

      // 1) aggiorna la scia (ping-pong a bassa risoluzione)
      gl.disable(gl.BLEND);
      gl.useProgram(pTrail.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trailB.fb);
      gl.viewport(0, 0, trailB.w, trailB.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, trailA.tex);
      gl.uniform1i(pTrail.u.uPrev, 0);
      gl.uniform2f(pTrail.u.uMouse, mx, my);
      gl.uniform2f(pTrail.u.uVel, vx, vy);
      gl.uniform1f(pTrail.u.uAspect, W / H);
      gl.uniform1f(pTrail.u.uForce, force);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      [trailA, trailB] = [trailB, trailA];

      // 2) disegna sullo schermo
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, trailA.tex);

      gl.useProgram(pBg.p);
      gl.uniform1i(pBg.u.uTrail, 1);
      gl.uniform2f(pBg.u.uRes, W, H);
      gl.uniform1f(pBg.u.uTime, time);
      gl.uniform1f(pBg.u.uCell, 5 * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.useProgram(pImg.p);
      gl.uniform1i(pImg.u.uTex, 0); gl.uniform1i(pImg.u.uTrail, 1);
      gl.uniform2f(pImg.u.uRes, W, H);
      gl.uniform1f(pImg.u.uTime, time);
      gl.uniform1f(pImg.u.uScroll, clamp(Math.abs(scrollVel) / 40));
      const cr = canvas.getBoundingClientRect();
      items.forEach((it) => {
        const r = it.el.getBoundingClientRect();
        const inView = r.bottom > cr.top && r.top < cr.bottom;
        if (!inView) { it.reveal = 0; return; }
        if (!it.tex) return;
        it.reveal = Math.min(1, it.reveal + 0.022);
        const rv = ease(it.reveal);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, it.tex);
        gl.uniform4f(pImg.u.uRect, (r.left - cr.left) * dpr, (r.top - cr.top) * dpr, r.width * dpr, r.height * dpr);
        gl.uniform2f(pImg.u.uQuad, r.width * dpr, r.height * dpr);
        gl.uniform1f(pImg.u.uImgAr, it.ar);
        gl.uniform1f(pImg.u.uCell, 4 * dpr);
        gl.uniform1f(pImg.u.uReveal, rv);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    };
  }
})();
