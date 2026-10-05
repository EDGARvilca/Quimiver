import { activeStep } from '../lib/story';

/**
 * Historia al hacer scroll: en escritorio la imagen fija cambia según el paso que se lee.
 * Sin JavaScript se ve la primera imagen y todos los textos; en celular cada paso ya trae su imagen.
 */
export function initStory(): void {
  document.querySelectorAll<HTMLElement>('[data-story]').forEach((story) => {
    const steps = [...story.querySelectorAll<HTMLElement>('[data-story-step]')];
    const frames = [...story.querySelectorAll<HTMLElement>('[data-story-frame]')];
    if (steps.length === 0 || frames.length === 0) {
      return;
    }
    let current = 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      const next = activeStep(
        steps.map((s) => s.getBoundingClientRect().top),
        window.innerHeight * 0.55,
      );
      if (next === current) {
        return;
      }
      frames[current]?.classList.remove('is-active');
      steps[current]?.classList.remove('is-active');
      frames[next]?.classList.add('is-active');
      steps[next]?.classList.add('is-active');
      current = next;
    };
    story.classList.add('is-enhanced');
    steps[0].classList.add('is-active');
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    update();
  });
}
