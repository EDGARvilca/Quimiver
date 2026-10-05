import { describe, expect, it } from 'vitest';
import { activeStep } from '../src/lib/story';

describe('activeStep', () => {
  it('muestra el primer paso antes de llegar a la historia', () => {
    expect(activeStep([900, 1500, 2100], 400)).toBe(0);
  });

  it('elige el último paso que pasó la línea de lectura', () => {
    expect(activeStep([-600, 100, 700], 400)).toBe(1);
  });

  it('se queda en el último paso al final', () => {
    expect(activeStep([-1800, -1200, -600], 400)).toBe(2);
  });
});
