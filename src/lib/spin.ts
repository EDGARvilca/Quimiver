const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/**
 * Avance (0 a 1) de una escena según el scroll: 0 cuando su borde superior asoma por abajo,
 * 1 cuando su borde inferior llega al final de la pantalla. Sirve igual para la escena fija
 * de escritorio (más alta que la pantalla) y para la escena normal del celular.
 */
export function sceneProgress(top: number, height: number, viewport: number): number {
  if (height <= 0) {
    return 0;
  }
  return clamp((viewport - top) / height);
}

/** Cuadro de la secuencia de fotos (0 a frames - 1) que corresponde al avance. */
export function frameAt(progress: number, frames: number): number {
  if (frames <= 1) {
    return 0;
  }
  return Math.round(clamp(progress) * (frames - 1));
}

/**
 * Giro de la foto cuando aún no hay secuencia: entra de lado (-28°) y queda de frente
 * al 65 % del recorrido, con un pequeño acercamiento.
 */
export function turnAt(progress: number): { rotateY: number; scale: number; sheen: number } {
  const t = clamp((progress - 0.1) / 0.55);
  const eased = 1 - (1 - t) ** 3;
  return {
    rotateY: Math.round(-28 * (1 - eased) * 10) / 10 || 0,
    scale: Math.round((0.9 + 0.1 * eased) * 1000) / 1000,
    sheen: Math.round(clamp(progress) * 100),
  };
}

/** Ruta del cuadro n (1, 2, …) a partir de un patrón con {n}, rellenado a dos cifras. */
export function framePath(pattern: string, index: number): string {
  return pattern.replace('{n}', String(index + 1).padStart(2, '0'));
}
