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
  el.innerHTML = '<span class="mouse-ico"></span><span>Continua a scorrere</span>';
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
