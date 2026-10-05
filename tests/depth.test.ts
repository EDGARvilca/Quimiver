import { describe, expect, it } from 'vitest';
import { parallaxOffset, tiltFromPointer } from '../src/lib/depth';

const box = { left: 100, top: 50, width: 200, height: 100 };

describe('tiltFromPointer', () => {
  it('no inclina con el puntero en el centro', () => {
    expect(tiltFromPointer(200, 100, box)).toEqual({
      rotateX: 0,
      rotateY: 0,
      glareX: 50,
      glareY: 50,
    });
  });

  it('inclina hasta el máximo en las esquinas', () => {
    expect(tiltFromPointer(300, 50, box, 6)).toEqual({
      rotateX: 6,
      rotateY: 6,
      glareX: 100,
      glareY: 0,
    });
  });

  it('limita el giro si el puntero sale de la tarjeta', () => {
    const t = tiltFromPointer(-500, 900, box, 6);
    expect(t.rotateX).toBe(-6);
    expect(t.rotateY).toBe(-6);
  });

  it('no falla con una tarjeta sin tamaño', () => {
    expect(tiltFromPointer(10, 10, { left: 0, top: 0, width: 0, height: 0 }).rotateX).toBe(0);
  });
});

describe('parallaxOffset', () => {
  it('mueve la capa en proporción al scroll', () => {
    expect(parallaxOffset(200, 0.2)).toBe(40);
  });

  it('respeta el límite', () => {
    expect(parallaxOffset(5000, 0.5, 160)).toBe(160);
  });
});
