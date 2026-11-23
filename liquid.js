/* ============================================================
   LOGO LIQUIDO — "SOURCE LAB" gigante nella hero.
   Due simulazioni calcolate dalla scheda grafica:
   1. FLUIDO: il mouse spinge il liquido; le lettere vengono trascinate,
      formano piccoli vortici e poi tornano lentamente al loro posto.
   2. SUPERFICIE: onde vere che si propagano e rimbalzano, con
      rifrazione, luce e riflessi come sull'acqua.
   In più il logo cambia composizione con una transizione "liquida".
   ============================================================ */

// ✏️ Composizioni del logo: ogni voce è una lista di righe.
//    fit = quanto larga è la riga rispetto allo schermo (1 = tutta la larghezza)
//    x   = spostamento orizzontale (0 = allineata a sinistra)
const LIQUID_LAYOUTS = [
  [ { text: "SOURCE", fit: 1.04, x: -0.02 }, { text: "LAB", fit: 0.62, x: 0.4 } ],
  [ { text: "SOURCE LAB SOURCE", fit: 1.6, x: -0.25 }, { text: "LAB SOURCE LAB", fit: 1.35, x: -0.05 }, { text: "SOURCE LAB SOURCE", fit: 1.6, x: -0.45 } ],
  [ { text: "LAB", fit: 1.02, x: -0.01 } ],
  [ { text: "SRC", fit: 0.7, x: -0.02 }, { text: "/LAB", fit: 0.9, x: 0.12 } ],
];
const WORDMARK_WEIGHT = 600; // ✏️ spessore del logo gigante (200 = sottile, 600 = più pieno)
const HOLD_MS = 3600;       // quanto resta ferma ogni composizione
const TRANSITION_MS = 1500; // durata della transizione liquida
// ✏️ Regolazioni dell'acqua
const FLUID_FORCE = 0.55;    // quanto il mouse trascina le lettere
const FLUID_RETURN = 0.975;  // quanto in fretta le lettere tornano a posto (più basso = più in fretta)
const SWIRL = 18;            // quanto il liquido forma vortici
const WAVE_STRENGTH = 1.0;   // altezza delle onde
const WAVE_DAMPING = 0.986;  // quanto durano le onde (più vicino a 1 = più a lungo)
const SHINE = 1.0;           // intensità dei riflessi di luce

(function () {
  const canvas = document.getElementById("liquid");
  if (!canvas) return;
  const hero = canvas.parentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const css = getComputedStyle(document.documentElement);
  const hexToRgb = (hex) => {
    const n = parseInt(hex.trim().replace("#", ""), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  const PRIMARY = hexToRgb(css.getPropertyValue("--primary") || "#7b2cff");
  const ACCENT = hexToRgb(css.getPropertyValue("--accent") || "#c6ff3d");

  /* ---------- Disegna una composizione su un canvas 2D ---------- */
  function renderLayout(layout, W, H) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "-0.02em";
    const font = (s) => `${WORDMARK_WEIGHT} ${s}px "Geist", system-ui, sans-serif`;

    // calcola la dimensione di ogni riga per riempire la larghezza
    const rows = layout.map((r) => {
      ctx.font = font(100);
      const size = (W * r.fit) / ctx.measureText(r.text).width * 100;
      return { ...r, size };
    });
    const lh = 0.74; // ✏️ interlinea (più basso = righe più vicine)
    // su schermi molto larghi rimpicciolisce, così non copre troppo il testo sotto
    const raw = rows.reduce((s, r) => s + r.size * lh, 0);
    const k = Math.min(1, (H * 0.5) / raw);
    rows.forEach((r) => (r.size *= k));
    const total = raw * k;
    // la composizione occupa la parte alta della hero (sotto c'è il testo)
    let y = Math.max(H * 0.09, (H * 0.58 - total) / 2);
    rows.forEach((r) => {
      y += r.size * lh;
      ctx.font = font(r.size);
      ctx.fillText(r.text, r.x * W, y);
    });
    return c;
  }


  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  const floatOK = gl && gl.getExtension("EXT_color_buffer_float");

  /* ---------- Fallback senza WebGL2: logo statico ---------- */
  if (!gl || !floatOK) {
    const draw = () => {
      const W = canvas.width = hero.clientWidth, H = canvas.height = hero.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = css.getPropertyValue("--bg"); ctx.fillRect(0, 0, W, H);
      const t = renderLayout(LIQUID_LAYOUTS[0], W, H), tc = t.getContext("2d");
      tc.globalCompositeOperation = "source-in"; tc.fillStyle = css.getPropertyValue("--primary"); tc.fillRect(0, 0, W, H);
      ctx.drawImage(t, 0, 0);
    };
    document.fonts.ready.then(draw);
    addEventListener("resize", draw);
    return;
  }
  const BG = hexToRgb(css.getPropertyValue("--bg") || "#050507");

  /* ---------- Shader ---------- */
  const VERT = `#version 300 es
    in vec2 p; out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
    uniform vec2 texel;
    void main(){ vUv = p * 0.5 + 0.5; vL = vUv - vec2(texel.x, 0.); vR = vUv + vec2(texel.x, 0.);
      vT = vUv + vec2(0., texel.y); vB = vUv - vec2(0., texel.y); gl_Position = vec4(p, 0., 1.); }`;
  const F = (body) => `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;
    ${body}`;

  const SH = {
    // aggiunge una "spinta" (velocità) o un'onda attorno al punto
    splat: F(`uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 value; uniform vec2 point;
      void main(){ vec2 d = vUv - point; d.x *= aspect; float g = exp(-dot(d, d) / radius);
        o = texture(uTarget, vUv) + vec4(value * g, 0.); }`),
    advect: F(`uniform sampler2D uVelocity, uSource; uniform float dt, keep;
      void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy; o = texture(uSource, c) * keep; }`),
    divergence: F(`uniform sampler2D uVelocity;
      void main(){ float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
        vec2 C = texture(uVelocity, vUv).xy;
        if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
        o = vec4(0.5 * (R - L + T - B), 0., 0., 1.); }`),
    curl: F(`uniform sampler2D uVelocity;
      void main(){ o = vec4(0.5 * (texture(uVelocity, vR).y - texture(uVelocity, vL).y - texture(uVelocity, vT).x + texture(uVelocity, vB).x), 0., 0., 1.); }`),
    vorticity: F(`uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
      void main(){ float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
        vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= curl * C; f.y *= -1.;
        o = vec4(texture(uVelocity, vUv).xy + f * dt, 0., 1.); }`),
    pressure: F(`uniform sampler2D uPressure, uDivergence;
      void main(){ o = vec4((texture(uPressure, vL).x + texture(uPressure, vR).x + texture(uPressure, vB).x + texture(uPressure, vT).x - texture(uDivergence, vUv).x) * 0.25, 0., 0., 1.); }`),
    gradient: F(`uniform sampler2D uPressure, uVelocity;
      void main(){ vec2 g = vec2(texture(uPressure, vR).x - texture(uPressure, vL).x, texture(uPressure, vT).x - texture(uPressure, vB).x);
        o = vec4(texture(uVelocity, vUv).xy - g, 0., 1.); }`),
    scale: F(`uniform sampler2D uTex; uniform float value; void main(){ o = texture(uTex, vUv) * value; }`),
    // spostamento accumulato: il liquido trascina le lettere, che poi tornano a posto
    displace: F(`uniform sampler2D uVelocity, uDisp; uniform float dt, keep, force;
      void main(){ vec2 v = texture(uVelocity, vUv).xy;
        vec2 d = texture(uDisp, vUv - dt * v).xy * keep + v * dt * force;
        o = vec4(clamp(d, -0.25, 0.25), 0., 1.); }`),
    // equazione delle onde: R = altezza attuale, G = altezza precedente
    wave: F(`uniform sampler2D uWave; uniform float damping;
      void main(){ vec2 c = texture(uWave, vUv).rg;
        float n = texture(uWave, vL).r + texture(uWave, vR).r + texture(uWave, vT).r + texture(uWave, vB).r;
        float h = (n * 0.5 - c.g) * damping;
        o = vec4(h, c.r, 0., 1.); }`),
    render: F(`uniform sampler2D uA, uB, uDisp, uWave; uniform vec2 waveTexel, res;
      uniform float uMix, uTime, shine; uniform vec3 uColor, uAccent, uBg;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
      float mask(vec2 uv){
        float n = vn(uv * vec2(3., 2.) + uTime * 0.15) * 0.75 + vn(uv * 14. - uTime * 0.4) * 0.25;
        float e = uMix * 1.3 - 0.15; return smoothstep(e - 0.06, e + 0.06, n);
      }
      float shape(vec2 uv, float m){ uv = clamp(uv, 0., 1.); return mix(texture(uB, uv).a, texture(uA, uv).a, m); }
      void main(){
        vec2 uv = vUv;
        // pendenza della superficie dell'acqua
        float hL = texture(uWave, uv - vec2(waveTexel.x, 0.)).r, hR = texture(uWave, uv + vec2(waveTexel.x, 0.)).r;
        float hB = texture(uWave, uv - vec2(0., waveTexel.y)).r, hT = texture(uWave, uv + vec2(0., waveTexel.y)).r;
        vec2 slope = vec2(hR - hL, hT - hB);
        vec3 n = normalize(vec3(-slope * 6., 1.));
        float curv = hL + hR + hB + hT - 4. * texture(uWave, uv).r;

        // spostamento del fluido + rifrazione delle onde + ondulazione leggera
        vec2 disp = texture(uDisp, uv).xy;
        vec2 idle = vec2(sin(uv.y * 8. + uTime * 0.8), cos(uv.x * 6. + uTime * 0.6)) * 0.0018;
        float m = mask(uv);
        float melt = 1. - abs(m * 2. - 1.);
        vec2 base = uv - disp + idle + vec2(0., melt * 0.03);
        vec2 refr = -n.xy * 0.05;

        // aberrazione cromatica leggera, solo dove l'acqua si muove
        float aR = shape(base + refr * 0.9, m);
        float aG = shape(base + refr, m);
        float aB = shape(base + refr * 1.12, m);
        float a = aG;

        vec3 letters = vec3(uColor.r * aR, uColor.g * aG, uColor.b * aB) / max(uColor, vec3(0.001)) * uColor;
        vec3 col = mix(uBg, uColor, a);
        col = mix(col, letters + uBg * (1. - a), 0.6);

        // luce: le lettere sono più chiare dove l'acqua si alza verso la luce
        vec3 L = normalize(vec3(-0.45, 0.55, 1.));
        float diff = dot(n, L);
        col *= mix(1., 0.75 + 0.45 * diff, a);
        // riflesso speculare e "caustiche" (concentrazioni di luce)
        vec3 Rf = reflect(-L, n);
        float spec = pow(max(Rf.z, 0.), 90.) * shine;
        float caustic = clamp(-curv * 18., 0., 1.) * shine;
        float wet = clamp(length(slope) * 14., 0., 1.);
        col += vec3(1.) * spec * 0.6 * wet;
        col += mix(uColor, vec3(1.), 0.35) * caustic * (0.25 + 0.5 * a);
        // bordo della superficie: un velo di luce viola sul nero
        col += uColor * wet * 0.10 * (1. - a);
        // grana finissima
        col += (hsh(gl_FragCoord.xy + uTime) - 0.5) * 0.012;
        o = vec4(col, 1.);
      }`),
  };

  const compile = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); return sh; };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const P = {};
  for (const [k, s] of Object.entries(SH)) {
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, s));
    gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
    const u = {}; const cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < cnt; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    P[k] = { p, u };
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texParams = () => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const fbo = (w, h, internal, format) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); texParams();
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h, texel: [1 / w, 1 / h] };
  };
  const dbl = (w, h, i, f) => { let a = fbo(w, h, i, f), b = fbo(w, h, i, f);
    return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, kill() { [a, b].forEach((x) => { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fb); }); } }; };
  const one = (t) => ({ kill() { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }, ...t });

  const texA = gl.createTexture(), texB = gl.createTexture();
  const upload = (tex, source) => {
    gl.bindTexture(gl.TEXTURE_2D, tex); texParams();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  };

  const run = (prog, target, uniforms) => {
    gl.useProgram(prog.p);
    let unit = 0;
    for (const [k, v] of Object.entries(uniforms)) {
      const loc = prog.u[k]; if (loc == null) continue;
      if (v && v.tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(loc, unit++); }
      else if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(loc, unit++); }
      else if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : gl.uniform3fv).call(gl, loc, v);
      else gl.uniform1f(loc, v);
    }
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let W = 0, H = 0, layoutCanvases = [];
  let vel, pres, divT, curlT, disp, wave;
  let current = 0, phaseStart = performance.now(), mixing = false;
  const sized = (res) => { const ar = W / H; return ar > 1 ? [Math.round(res * ar), res] : [res, Math.round(res / ar)]; };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.round(hero.clientWidth * dpr); H = Math.round(hero.clientHeight * dpr);
    canvas.width = W; canvas.height = H;
    layoutCanvases = LIQUID_LAYOUTS.map((l) => renderLayout(l, W, H));
    upload(texA, layoutCanvases[current]);
    upload(texB, layoutCanvases[(current + 1) % layoutCanvases.length]);
    [vel, pres, divT, curlT, disp, wave].forEach((x) => x && x.kill());
    const [sw, sh] = sized(128), [dw, dh] = sized(256), [ww, wh] = sized(Math.min(420, Math.round(H / 2.2)));
    vel = dbl(sw, sh, gl.RG16F, gl.RG); pres = dbl(sw, sh, gl.R16F, gl.RED);
    divT = one(fbo(sw, sh, gl.R16F, gl.RED)); curlT = one(fbo(sw, sh, gl.R16F, gl.RED));
    disp = dbl(dw, dh, gl.RG16F, gl.RG); wave = dbl(ww, wh, gl.RG16F, gl.RG);
  }

  const splat = (field, x, y, value, radius) => {
    run(P.splat, field.write, { uTarget: field.read, aspect: W / H, point: [x, y], value, radius, texel: field.read.texel });
    field.swap();
  };

  /* ---------- Mouse / touch ---------- */
  let last = null;
  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    const now = performance.now();
    if (last) {
      const dt = Math.max(8, now - last.t) / 1000;
      const vx = (x - last.x) / dt, vy = (y - last.y) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp > 0.01) {
        splat(vel, x, y, [vx * 0.6 * FLUID_FORCE, vy * 0.6 * FLUID_FORCE, 0], 0.0022);
        splat(wave, x, y, [-Math.min(0.9, sp * 0.06) * WAVE_STRENGTH, 0, 0], 0.00018);
      }
    }
    last = { x, y, t: now };
  });
  hero.addEventListener("pointerleave", () => (last = null));
  hero.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    splat(wave, x, y, [-1.6 * WAVE_STRENGTH, 0, 0], 0.0006);
  });

  /* ---------- Simulazione ---------- */
  function step(dt) {
    const t = vel.read.texel;
    run(P.curl, curlT, { uVelocity: vel.read, texel: t });
    run(P.vorticity, vel.write, { uVelocity: vel.read, uCurl: curlT, curl: SWIRL, dt, texel: t }); vel.swap();
    run(P.divergence, divT, { uVelocity: vel.read, texel: t });
    run(P.scale, pres.write, { uTex: pres.read, value: 0.8, texel: t }); pres.swap();
    for (let i = 0; i < 16; i++) { run(P.pressure, pres.write, { uPressure: pres.read, uDivergence: divT, texel: t }); pres.swap(); }
    run(P.gradient, vel.write, { uPressure: pres.read, uVelocity: vel.read, texel: t }); vel.swap();
    run(P.advect, vel.write, { uVelocity: vel.read, uSource: vel.read, dt, keep: 0.975, texel: t }); vel.swap();
    // spostamento delle lettere
    run(P.displace, disp.write, { uVelocity: vel.read, uDisp: disp.read, dt, keep: FLUID_RETURN, force: 1.0, texel: disp.read.texel }); disp.swap();
    // onde (due passi per frame: si propagano più veloci e più lisce)
    for (let i = 0; i < 2; i++) { run(P.wave, wave.write, { uWave: wave.read, damping: WAVE_DAMPING, texel: wave.read.texel }); wave.swap(); }
  }

  /* ---------- Loop ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);
  let prev = performance.now(), nextDrop = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !W) { prev = now; return; }
    const dt = Math.min((now - prev) / 1000, 1 / 30); prev = now;

    let m = 0;
    if (!reduce) {
      const el = now - phaseStart;
      if (!mixing && el > HOLD_MS) { mixing = true; phaseStart = now; }
      else if (mixing) {
        m = Math.min(1, el / TRANSITION_MS);
        if (m >= 1) {
          mixing = false; phaseStart = now; m = 0;
          current = (current + 1) % layoutCanvases.length;
          upload(texA, layoutCanvases[current]);
          upload(texB, layoutCanvases[(current + 1) % layoutCanvases.length]);
        }
      }
      // ogni tanto una goccia e una leggera corrente, così il liquido vive da solo
      if (now > nextDrop) {
        const x = 0.1 + Math.random() * 0.8, y = 0.45 + Math.random() * 0.5, a = Math.random() * Math.PI * 2;
        splat(wave, x, y, [-0.5 * WAVE_STRENGTH, 0, 0], 0.0003);
        splat(vel, x, y, [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0], 0.01);
        nextDrop = now + 1600 + Math.random() * 2200;
      }
      step(dt);
    }

    run(P.render, null, {
      uA: texA, uB: texB, uDisp: disp.read, uWave: wave.read, waveTexel: wave.read.texel, res: [W, H],
      uMix: m * m * (3 - 2 * m), uTime: now / 1000, shine: SHINE,
      uColor: PRIMARY, uAccent: ACCENT, uBg: BG, texel: [1 / W, 1 / H],
    });
  }

  document.fonts.load(`${WORDMARK_WEIGHT} 100px "Geist"`).then(() => document.fonts.ready).then(() => {
    resize();
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    requestAnimationFrame(frame);
  });
})();
