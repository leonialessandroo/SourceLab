/* ============================================================
   PROMEMORIA "CONTINUA A SCORRERE"
   Se resti fermo qualche secondo a metà pagina (fuori dalla prima schermata
   e non in fondo), in basso a destra compare un piccolo invito a scorrere.
   Sparisce appena riprendi a scorrere.
   ============================================================ */
(() => {
  const IDLE_MS = 4000;                                   // ✏️ dopo quanti secondi di pausa compare
  const el = document.createElement("div");
  el.className = "scroll-hint"; el.setAttribute("aria-hidden", "true");
  const finger = '<span class="finger-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5"/><path d="M11 11.5v-2a1.5 1.5 0 1 1 3 0v2.5"/><path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47"/></svg></span>';
  // mouse su computer, dito che scorre su telefoni e tablet (lo sceglie il CSS)
  el.innerHTML = '<span class="mouse-ico"></span>' + finger + '<span>Continua a scorrere</span>';
  document.body.appendChild(el);

  let timer = 0, lastY = scrollY;
  const blocked = () =>
    document.body.style.overflow === "hidden" ||            // menu o concept aperti
    document.body.classList.contains("is-loading") ||
    scrollY < innerHeight * 0.6 ||                          // nella prima schermata c'è già l'invito
    scrollY > document.documentElement.scrollHeight - innerHeight * 1.6; // quasi in fondo
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!blocked()) el.classList.add("is-on"); }, IDLE_MS);
  };
  addEventListener("scroll", () => {
    if (Math.abs(scrollY - lastY) > 4) { el.classList.remove("is-on"); lastY = scrollY; schedule(); }
  }, { passive: true });
  schedule();
})();
