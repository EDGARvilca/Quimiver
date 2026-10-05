/**
 * Paso activo de la historia: el último cuyo borde superior ya pasó la línea de lectura
 * (por defecto, la mitad de la pantalla). Antes del primero, se muestra el primero.
 */
export function activeStep(stepTops: number[], readingLine: number): number {
  let active = 0;
  stepTops.forEach((top, i) => {
    if (top <= readingLine) {
      active = i;
    }
  });
  return active;
}
