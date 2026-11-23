/* ============================================================
   SFONDO "A PIXEL" CHE SEGUE IL CURSORE
   Come funziona:
   1. SCIA: una macchia morbida segue il mouse e lascia una scia che
      svanisce piano (viene ridisegnata ogni frame un po' più debole).
   2. NUVOLA A PIXEL: un rumore animato lentissimo viene trasformato in
      puntini viola con una retinatura (dithering) a celle di pochi pixel.
      La nuvola si vede solo dove c'è la scia del cursore.
   ============================================================ */

// ✏️ Regolazioni
const BG_CELL = 3;          // grandezza dei "pixel" della retinatura (px)
const BG_FADE = 0.972;      // quanto dura la scia (più vicino a 1 = più lunga)
const BG_RADIUS = 0.22;     // grandezza della macchia del cursore
const BG_INTENSITY = 0.8;   // luminosità generale (0–1)

(function () {
  const canvas = document.getElementById("glow");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hex = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim().replace("#", "");
  const n = parseInt(hex, 16);
  const COLOR = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  // --- scia del cursore (si accumula frame dopo frame) ---
  const TRAIL_FRAG = `
    precision highp float;
    uniform sampler2D uPrev;
    uniform vec2 uRes, uPointer;
    uniform float uStrength, uRadius, uTime, uFade;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      float aspect = uRes.x / uRes.y;
      // il bordo della macchia ondeggia, così non è un cerchio perfetto
      vec2 w = uv + (vec2(vn(uv*3.0 + uTime*0.15), vn(uv*3.0 - uTime*0.12)) - 0.5) * 0.08;
      float d = length((w - uPointer) * vec2(aspect, 1.0));
      float blob = smoothstep(uRadius, 0.0, d) * uStrength;
      float prev = texture2D(uPrev, uv).r;
      float v = max(prev * uFade - 0.004, 0.0) + blob * 0.12;
      gl_FragColor = vec4(vec3(min(v, 1.0)), 1.0);
    }`;

  // --- sfondo: nuvola di rumore + retinatura a pixel ---
  const BG_FRAG = `
    precision highp float;
    uniform sampler2D uTrail;
    uniform vec2 uRes;
    uniform float uTime, uCell, uIntensity;
    uniform vec3 uColor;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ v += a * vn(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
    // matrice di Bayer 4x4 (soglie della retinatura)
    float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    void main(){
      vec2 cell = floor(gl_FragCoord.xy / uCell);
      vec2 cuv = (cell + 0.5) * uCell / uRes;              // centro della cella
      float aspect = uRes.x / uRes.y;
      float cloud = fbm(vec2(cuv.x * aspect, cuv.y) * 2.6 + vec2(uTime * 0.05, -uTime * 0.035));
      cloud = smoothstep(0.15, 0.95, cloud);
      float trail = texture2D(uTrail, cuv).r;
      float b = cloud * trail * uIntensity;
      float on = step(bayer4(cell) + 0.02, b);              // pixel acceso o spento
      vec3 col = uColor * on * (0.35 + 0.65 * trail);
      col += uColor * trail * cloud * 0.08;                   // leggero alone morbido sotto
      gl_FragColor = vec4(col, 1.0);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (frag) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    const u = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  };
  const trailProg = program(TRAIL_FRAG);
  const bgProg = program(BG_FRAG);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bindQuad = (prog) => {
    const loc = gl.getAttribLocation(prog.p, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };

  // due "fogli" per la scia, usati a turno (ping-pong)
  let W = 0, H = 0, TW = 0, TH = 0, targets = [], idx = 0;
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
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb };
  };
  const resize = () => {
    // sfondo a pixel: risoluzione 1:1 con i pixel CSS, i pixel restano netti
    W = canvas.width = innerWidth; H = canvas.height = innerHeight;
    TW = Math.max(2, Math.round(W / 4)); TH = Math.max(2, Math.round(H / 4));
    targets.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    targets = [makeTarget(TW, TH), makeTarget(TW, TH)];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  resize();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

  // puntatore
  let px = 0.5, py = 0.5, lx = 0.5, ly = 0.5, mouse = false, strength = 0;
  addEventListener("pointermove", (e) => {
    px = e.clientX / innerWidth; py = 1 - e.clientY / innerHeight; mouse = true;
  }, { passive: true });

  function frame(now) {
    requestAnimationFrame(frame);
    if (!canvas.classList.contains("is-on")) return;
    const t = now / 1000;

    // senza mouse (telefono) la macchia gira lentamente da sola
    if (!mouse) { px = 0.5 + 0.32 * Math.sin(t * 0.35); py = 0.5 + 0.28 * Math.cos(t * 0.27); }
    // la macchia "si accende" quando ti muovi e si spegne quando ti fermi
    const speed = Math.hypot(px - lx, py - ly) * 60;
    strength += (Math.min(1, speed * 1.5 + (mouse ? 0 : 0.6)) - strength) * 0.15;
    lx += (px - lx) * 0.25; ly += (py - ly) * 0.25;

    // 1) aggiorna la scia
    const src = targets[idx], dst = targets[1 - idx];
    gl.useProgram(trailProg.p); bindQuad(trailProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, TW, TH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(trailProg.u.uPrev, 0);
    gl.uniform2f(trailProg.u.uRes, TW, TH);
    gl.uniform2f(trailProg.u.uPointer, lx, ly);
    gl.uniform1f(trailProg.u.uStrength, reduce ? 0.4 : strength);
    gl.uniform1f(trailProg.u.uRadius, BG_RADIUS);
    gl.uniform1f(trailProg.u.uTime, t);
    gl.uniform1f(trailProg.u.uFade, BG_FADE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    idx = 1 - idx;

    // 2) disegna lo sfondo a pixel
    gl.useProgram(bgProg.p); bindQuad(bgProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.tex);
    gl.uniform1i(bgProg.u.uTrail, 0);
    gl.uniform2f(bgProg.u.uRes, W, H);
    gl.uniform1f(bgProg.u.uTime, reduce ? 0 : t);
    gl.uniform1f(bgProg.u.uCell, BG_CELL);
    gl.uniform1f(bgProg.u.uIntensity, BG_INTENSITY);
    gl.uniform3fv(bgProg.u.uColor, COLOR);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();
