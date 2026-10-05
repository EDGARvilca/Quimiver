/**
 * Cálculos puros de los efectos de profundidad (sin DOM), para poder probarlos.
 */

export interface Tilt {
  /** Giro sobre el eje X, en grados (positivo = parte superior hacia atrás). */
  rotateX: number;
  /** Giro sobre el eje Y, en grados. */
  rotateY: number;
  /** Posición del brillo en porcentaje del ancho y del alto. */
  glareX: number;
  glareY: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

/** Inclinación de una tarjeta según dónde está el puntero dentro de ella. */
export function tiltFromPointer(x: number, y: number, box: Box, maxDegrees = 6): Tilt {
  if (box.width <= 0 || box.height <= 0) {
    return { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 };
  }
  const px = clamp((x - box.left) / box.width, 0, 1);
  const py = clamp((y - box.top) / box.height, 0, 1);
  return {
    rotateX: round((0.5 - py) * 2 * maxDegrees) || 0,
    rotateY: round((px - 0.5) * 2 * maxDegrees) || 0,
    glareX: round(px * 100),
    glareY: round(py * 100),
  };
}

/** Desplazamiento vertical de una capa decorativa según el scroll (efecto paralaje). */
export function parallaxOffset(scrollY: number, depth: number, limit = 160): number {
  return round(clamp(scrollY * depth, -limit, limit)) || 0;
}
