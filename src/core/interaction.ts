/**
 * Führt einen Callback genau einmal aus – bei der ersten Nutzerinteraktion
 * (pointerdown/tastendruck außerhalb von Formularfeldern).
 * Wird von MIDI-Lazy-Init und dem Audio-Unlock gemeinsam genutzt.
 */
export function onFirstInteraction(cb: () => void): void {
  let done = false;
  const fire = (e: Event): void => {
    // Nicht auf Tastendrücke in Formularfeldern reagieren (z. B. Shader-Editor)
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (done) return;
    done = true;
    window.removeEventListener('pointerdown', fire);
    window.removeEventListener('keydown', fire);
    cb();
  };
  window.addEventListener('pointerdown', fire);
  window.addEventListener('keydown', fire);
}
