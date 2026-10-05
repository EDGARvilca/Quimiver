import { parallaxOffset, tiltFromPointer } from '../lib/depth';
import { frameAt, framePath, sceneProgress, turnAt } from '../lib/spin';

/**
 * Efectos de profundidad ligeros:
 * - [data-tilt]: la tarjeta se inclina en 3D siguiendo el mouse (solo con puntero fino).
 * - [data-depth]: capas decorativas que se desplazan a distinta velocidad al hacer scroll.
 * - [data-spin-scene]: el frasco gira al bajar (secuencia de fotos si existe; si no, giro 3D de la foto).
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
  initSpin();
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

function initSpin(): void {
  document.querySelectorAll<HTMLElement>('[data-spin-scene]').forEach((scene) => {
    const card = scene.querySelector<HTMLElement>('[data-spin]');
    if (!card) {
      return;
    }
    const image = card.querySelector<HTMLImageElement>('[data-spin-image]');
    const pattern = card.dataset.spinPattern;
    const frames = Number(card.dataset.spinFrames) || 0;
    const useFrames = Boolean(image && pattern && frames > 1);
    let loaded = false;
    let lastFrame = -1;

    // Los cuadros se descargan solo cuando la escena está por aparecer.
    const preload = () => {
      if (loaded || !useFrames || !pattern) {
        return;
      }
      loaded = true;
      for (let i = 1; i < frames; i++) {
        new Image().src = framePath(pattern, i);
      }
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            preload();
            observer.disconnect();
          }
        },
        { rootMargin: '100% 0px' },
      );
      observer.observe(scene);
    } else {
      preload();
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const box = scene.getBoundingClientRect();
      const progress = sceneProgress(box.top, box.height, window.innerHeight);
      if (useFrames && image && pattern) {
        const frame = frameAt(progress, frames);
        if (frame !== lastFrame) {
          lastFrame = frame;
          image.src = framePath(pattern, frame);
        }
        return;
      }
      const turn = turnAt(progress);
      card.style.setProperty('--spin-y', `${turn.rotateY}deg`);
      card.style.setProperty('--spin-scale', String(turn.scale));
      card.style.setProperty('--spin-sheen', String(Math.abs(turn.rotateY) / 35));
      card.style.setProperty('--glare-x', `${15 + turn.sheen}%`);
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
  });
}

const REVEAL_SELECTOR = [
  '.section-heading',
  '.split-media',
  '.split-text',
  '.showcase-text',
  '.story-band-text',
  '.steps-figure',
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
