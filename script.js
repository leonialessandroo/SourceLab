// ✏️ Email a cui arrivano le richieste del modulo contatti
const EMAIL = "studio@sourcelab.it";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = matchMedia("(hover: hover)").matches;
document.getElementById("year").textContent = new Date().getFullYear();

/* ============================================================
   UTILITÀ: divide un testo in parole (per le animazioni)
   ============================================================ */
function splitWords(el, step = 45) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(" ");
          const w = document.createElement("span");
          w.className = "w";
          const s = document.createElement("span");
          s.textContent = part;
          s.style.transitionDelay = `${i++ * step}ms`;
          w.append(s);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
  };
  walk(el);
}

/* ============================================================
   SCROLL FLUIDO (Lenis)
   ============================================================ */
let lenis = null;
if (window.Lenis && !reduceMotion) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" || id === "#" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    if (menu.classList.contains("is-open")) setMenu(false); // chiude il menu prima di scorrere
    requestAnimationFrame(() => {
      if (lenis) lenis.scrollTo(target, { offset: -40, duration: 1.6 });
      else (target === 0 ? document.body : target).scrollIntoView({ behavior: "smooth" });
    });
  });
});

/* ============================================================
   CARICAMENTO INIZIALE
   1. Schermo viola: un piccolo logo a pixel cambia forma (S → L → goccia)
      mentre il nome si svela e il contatore arriva a 100
   2. Lo schermo viola si scompone in pixel che spariscono a ondate
      dal centro verso i bordi e scoprono il sito
   ============================================================ */
const heroTitle = document.getElementById("hero-title");
splitWords(heroTitle, 40);

const loader = document.getElementById("loader");
const LOADER_MS = 2000; // ✏️ durata della prima fase (ms)

const PIXEL_FRAMES = [
  // S
  ".####" + "#...." + ".###." + "....#" + "####.",
  // L
  "#...." + "#...." + "#...." + "#...." + "#####",
  // goccia
  "..#.." + ".###." + "#####" + "#####" + ".###.",
];

function finishIntro() {
  document.body.classList.remove("is-loading");
  heroTitle.classList.add("is-in");
  lenis?.start();
}

// arrivando da un'altra pagina del sito il caricamento non si ripete (c'è già il cambio a quadrati)
let fromPage = false;
try { fromPage = !!sessionStorage.getItem("sl-pt"); } catch (e) {}
if (reduceMotion || fromPage) {
  loader.remove();
  finishIntro();
} else {
  document.body.classList.add("is-loading");
  lenis?.stop();

  // logo a pixel
  const mark = document.getElementById("loader-mark");
  const cells = Array.from({ length: 25 }, () => mark.appendChild(document.createElement("i")));
  const showFrame = (pattern) => cells.forEach((c, i) => {
    c.style.transitionDelay = `${(i % 5) * 25 + Math.floor(i / 5) * 25}ms`;
    c.classList.toggle("on", pattern[i] === "#");
  });
  showFrame(cells.map(() => (Math.random() > 0.55 ? "#" : ".")).join(""));
  PIXEL_FRAMES.forEach((f, n) => setTimeout(() => showFrame(f), 450 + n * 480));

  // contatore 000 → 100
  const num = document.getElementById("loader-num");
  const t0 = performance.now();
  const counter = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / LOADER_MS);
    num.textContent = String(Math.round((1 - Math.pow(1 - p, 2)) * 100)).padStart(3, "0");
    if (p >= 1) clearInterval(counter);
  }, 30);

  // canvas: lo schermo viola è fatto di "pixel" quadrati, come il logo.
  // All'uscita i pixel si rimpiccioliscono e ruotano, a ondate dal centro verso i bordi.
  const lc = document.getElementById("loader-canvas");
  const lctx = lc.getContext("2d");
  const PRIMARY = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const ACCENT = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  let LW = 0, LH = 0, tiles = [];
  const sizeLoader = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    LW = innerWidth; LH = innerHeight;
    lc.width = LW * d; lc.height = LH * d;
    lctx.setTransform(d, 0, 0, d, 0, 0);
    const size = Math.max(LW, LH) / 16; // ✏️ dimensione dei pixel
    const cols = Math.ceil(LW / size) + 1, rows = Math.ceil(LH / size) + 1;
    const maxD = Math.hypot(cols / 2, rows / 2);
    tiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x + 0.5 - cols / 2, y + 0.5 - rows / 2) / maxD;
      tiles.push({ x: x * size, y: y * size, s: size, delay: d * 0.55 + Math.random() * 0.12 });
    }
  };
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const paint = (t) => { // t in secondi dall'inizio dell'uscita (-1 = schermo pieno)
    lctx.clearRect(0, 0, LW, LH);
    if (t < 0) { lctx.fillStyle = PRIMARY; lctx.fillRect(0, 0, LW, LH); return; }
    tiles.forEach((tl) => {
      const p = Math.min(1, Math.max(0, (t - tl.delay) / 0.55));
      if (p >= 1) return;
      const k = 1 - ease(p);
      const s = tl.s * k + 0.6; // +0.6 evita righe sottili tra i pixel
      lctx.save();
      lctx.translate(tl.x + tl.s / 2, tl.y + tl.s / 2);
      lctx.rotate(ease(p) * 0.8);
      // per un attimo, mentre spariscono, i pixel lampeggiano col colore accento
      lctx.fillStyle = p > 0.15 && p < 0.35 && tl.delay % 0.1 < 0.012 ? ACCENT : PRIMARY;
      lctx.fillRect(-s / 2, -s / 2, s, s);
      lctx.restore();
    });
  };
  sizeLoader();
  paint(-1);
  addEventListener("resize", () => { if (loader.isConnected) { sizeLoader(); paint(-1); } });

  const openHole = () => {
    loader.classList.add("is-leaving");
    const start = performance.now();
    setTimeout(finishIntro, 200);
    const frame = (now) => {
      const t = (now - start) / 1000;
      paint(t);
      if (t < 1.3) requestAnimationFrame(frame);
      else loader.remove();
    };
    requestAnimationFrame(frame);
  };
  setTimeout(openHole, LOADER_MS + 150);
  // sicurezza: se qualcosa va storto il sito si mostra comunque
  setTimeout(() => { if (loader.isConnected) { loader.remove(); finishIntro(); } }, LOADER_MS + 4000);
}

/* ============================================================
   02 LAVORI: carosello di anteprime (si trascina) + concept a schermo intero
   ============================================================ */
const cmodal = document.getElementById("cmodal");
const cTitle = document.getElementById("cmodal-title");
const slides = [...cmodal.querySelectorAll(".slide")];
const NAMES = ["Brace — Ristorante", "Ferri & Associati — Commercialisti", "NORDA — Negozio online"];
let currentConcept = 0;
const sizeScreens = () => cmodal.querySelectorAll(".slide.is-on .browser__screen, .slide.is-on .phone__screen")
  .forEach((s) => s.style.setProperty("--h", `${s.clientHeight}px`));
const showConcept = (i) => {
  currentConcept = (i + slides.length) % slides.length;
  slides.forEach((s, k) => s.classList.toggle("is-on", k === currentConcept));
  cTitle.textContent = NAMES[currentConcept];
  cmodal.scrollTop = 0;
  requestAnimationFrame(sizeScreens);
};
const openConcept = (i) => {
  showConcept(i);
  cmodal.classList.add("is-open");
  cmodal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  lenis?.stop();
};
const closeConcept = () => {
  cmodal.classList.remove("is-open");
  cmodal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  lenis?.start();
};
// lo showreel apre il concept che sta mostrando (l'ultimo fotogramma porta ai contatti)
const reelBox = document.querySelector(".reelshow");
const openFromReel = () => {
  const f = document.querySelector(".reelshow figure.is-on");
  if (f && f.dataset.concept) openConcept(Number(f.dataset.concept));
  else document.querySelector('a[href="#contatti"]').click();
};
reelBox.addEventListener("click", openFromReel);
reelBox.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openFromReel()));
cmodal.querySelector(".cmodal__close").addEventListener("click", closeConcept);
cmodal.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => showConcept(currentConcept + Number(b.dataset.step))));
addEventListener("keydown", (e) => {
  if (!cmodal.classList.contains("is-open")) return;
  if (e.key === "Escape") closeConcept();
  if (e.key === "ArrowRight") showConcept(currentConcept + 1);
  if (e.key === "ArrowLeft") showConcept(currentConcept - 1);
});
addEventListener("resize", sizeScreens);

/* ============================================================
   PACCHETTI: righe che si aprono (col mouse o col tocco)
   ============================================================ */
document.querySelectorAll(".pack__row").forEach((row) => row.addEventListener("click", () => {
  const pack = row.parentElement;
  const open = !pack.classList.contains("is-open");
  document.querySelectorAll(".pack").forEach((p) => p.classList.remove("is-open"));
  pack.classList.toggle("is-open", open);
}));
// "Scegli questo" preseleziona il pacchetto nel modulo contatti
document.querySelectorAll("[data-choose]").forEach((a) => a.addEventListener("click", () => {
  const radio = document.querySelector(`.choices input[value="${a.dataset.choose}"]`);
  if (radio) radio.checked = true;
}));

/* ============================================================
   REVEAL ALLO SCROLL
   ============================================================ */
// titoli delle sezioni: parole che salgono
document.querySelectorAll(".ed h2, .ed-statement").forEach((h) => {
  h.classList.remove("reveal");
  h.classList.add("split-words");
  splitWords(h, 55);
});

// nome gigante nel footer: le lettere salgono una alla volta
const footMark = document.querySelector(".ed-footer__mark");
if (footMark) footMark.innerHTML = [...footMark.textContent].map((ch, i) =>
  `<span style="transition-delay:${i * 45}ms">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  });
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 3) * 90}ms`;
  io.observe(el);
});
document.querySelectorAll(".split-words, .ed-footer__mark").forEach((el) => io.observe(el));

/* ============================================================
   SCROLL: header, barra di avanzamento, parallasse hero
   ============================================================ */
const header = document.getElementById("header");
const progress = document.getElementById("progress");
const liquid = document.getElementById("liquid");
// ✏️ cambio colore: ogni sezione ha data-theme="light" o "dark";
//    quella al centro dello schermo decide il colore di tutta la pagina
const themed = [...document.querySelectorAll("[data-theme]")];
const reel = document.getElementById("reel");
// showreel: i concept si alternano da soli ogni 2,8 secondi
const reelFrames = [...document.querySelectorAll(".reelshow figure")];
let reelI = 0;
const swapReel = () => {
  reelFrames[reelI].classList.remove("is-on");
  reelI = (reelI + 1) % reelFrames.length;
  reelFrames[reelI].classList.add("is-on");
  const c = reelFrames[reelI].dataset.concept;
  document.getElementById("reel-tag").textContent = c ? `Concept · ${NAMES[c]}` : "Source Lab";
  document.getElementById("reel-play").textContent = c ? "[ Apri il concept ]" : "[ Parliamone ]";
  document.querySelectorAll(".reelshow__dots i").forEach((d, k) => d.classList.toggle("is-on", k === reelI));
};
// motion.js, se presente, fa il cambio "a quadrati" (window.reelTransition)
if (reelFrames.length && !reduceMotion) setInterval(() => {
  if (window.reelTransition) window.reelTransition(swapReel); else swapReel();
}, 3600);
const onScroll = () => {
  const y = scrollY;
  header.classList.toggle("is-scrolled", y > 40);
  const mid = innerHeight * 0.5;
  const current = themed.find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
  if (current) document.documentElement.classList.toggle("theme-light", current.dataset.theme === "light");
  // il riquadro dei lavori cresce mentre entra nello schermo
  if (reel && !reduceMotion) {
    const r = reel.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.8)));
    reel.style.setProperty("--p", p.toFixed(3));
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  // leggera parallasse: il logo liquido scende più lento del testo
  if (!reduceMotion && y < innerHeight * 1.2) {
    liquid.style.translate = `0 ${y * 0.35}px`;
    heroTitle.style.translate = `0 ${y * -0.12}px`;
  }
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
onScroll();

/* ============================================================
   MENU
   ============================================================ */
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menu-btn");
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

/* ============================================================
   MODULO CONTATTI
   Per ora apre il programma di posta con la richiesta già compilata.
   Più avanti puoi collegarlo a un servizio come Formspree o Netlify Forms.
   ============================================================ */
document.getElementById("contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  const subject = `Richiesta ${d.get("servizio")} — ${d.get("nome")}`;
  const body = `Nome: ${d.get("nome")}\nEmail: ${d.get("email")}\nServizio: ${d.get("servizio")}\n\n${d.get("messaggio")}`;
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById("form-status").textContent = "Grazie! Si sta aprendo il tuo programma di posta.";
});
