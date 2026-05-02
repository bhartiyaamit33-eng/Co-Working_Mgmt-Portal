/**
 * Strip Emergent preview/badge DOM if it appears (stale index.html, caches, or host injection).
 */
(function removeEmergentInjections() {
  function sweep() {
    document.getElementById("emergent-badge")?.remove();
    document.querySelectorAll('script[src*="emergent.sh"]').forEach((el) => el.remove());
    document.querySelectorAll('a[href*="app.emergent.sh"]').forEach((el) => el.remove());
    document.querySelectorAll('a[href*="emergent.sh"]').forEach((el) => el.remove());
  }

  sweep();

  if (typeof MutationObserver === "undefined") return;

  let frame = null;
  const obs = new MutationObserver(() => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      sweep();
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
