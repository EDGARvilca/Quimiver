import { parallaxOffset, tiltFromPointer } from '../lib/depth';

/**
 * Efectos de profundidad ligeros:
 * - [data-tilt]: la tarjeta se inclina en 3D siguiendo el mouse (solo con puntero fino).
 * - [data-depth]: capas decorativas que se desplazan a distinta velocidad al hacer scroll.
 * - Aparición suave de secciones al entrar en pantalla.
 *
 * Sin JavaScript, o con "reducir movimiento" activado en el sistema, todo se ve estático y completo.
 */
export function initDepth(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  document.documentElement.classList.add('depth-ready');
  initTilt();
  initParallax();
  initReveal();
}

function initTilt(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    let frame = 0;
    card.addEventListener('pointermove', (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const t = tiltFromPointer(event.clientX, event.clientY, card.getBoundingClientRect());
        card.style.setProperty('--tilt-x', `${t.rotateX}deg`);
        card.style.setProperty('--tilt-y', `${t.rotateY}deg`);
        card.style.setProperty('--glare-x', `${t.glareX}%`);
        card.style.setProperty('--glare-y', `${t.glareY}%`);
        card.dataset.tilting = 'true';
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      delete card.dataset.tilting;
    });
  });
}

function initParallax(): void {
  const layers = [...document.querySelectorAll<HTMLElement>('[data-depth]')];
  if (layers.length === 0) {
    return;
  }
  let ticking = false;
  const update = () => {
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.depth) || 0;
      layer.style.transform = `translate3d(0, ${parallaxOffset(window.scrollY, depth)}px, 0)`;
    });
    ticking = false;
  };
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
}

const REVEAL_SELECTOR = [
  '.section-heading',
  '.split-media',
  '.split-text',
  '.steps-grid > li',
  '.faq-list',
  '.order-intro',
  '.order-form',
  '.info-grid > *',
  '.price-table',
].join(',');

function initReveal(): void {
  if (!('IntersectionObserver' in window)) {
    return;
  }
  const targets = [...document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)];
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  targets.forEach((target, i) => {
    target.classList.add('reveal');
    // Los elementos de una misma fila aparecen escalonados.
    target.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
    observer.observe(target);
  });
}
