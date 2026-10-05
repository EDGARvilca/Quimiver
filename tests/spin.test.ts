import { describe, expect, it } from 'vitest';
import { frameAt, framePath, sceneProgress, turnAt } from '../src/lib/spin';

describe('sceneProgress', () => {
  it('0 cuando la escena asoma por abajo, 1 cuando termina', () => {
    expect(sceneProgress(900, 1620, 900)).toBe(0);
    expect(sceneProgress(90, 1620, 900)).toBe(0.5);
    expect(sceneProgress(-720, 1620, 900)).toBe(1);
    expect(sceneProgress(-3000, 1620, 900)).toBe(1);
  });

  it('no falla con una escena sin altura', () => {
    expect(sceneProgress(0, 0, 900)).toBe(0);
  });
});

describe('frameAt', () => {
  it('reparte el avance entre los cuadros', () => {
    expect(frameAt(0, 36)).toBe(0);
    expect(frameAt(0.5, 36)).toBe(18);
    expect(frameAt(1, 36)).toBe(35);
    expect(frameAt(2, 36)).toBe(35);
  });
});

describe('turnAt', () => {
  it('empieza de lado y termina de frente', () => {
    expect(turnAt(0.1)).toEqual({ rotateY: -28, scale: 0.9, sheen: 10 });
    expect(turnAt(0.7)).toEqual({ rotateY: 0, scale: 1, sheen: 70 });
  });
});

describe('framePath', () => {
  it('rellena el número del cuadro', () => {
    expect(framePath('/images/giro/giro-{n}.webp', 0)).toBe('/images/giro/giro-01.webp');
    expect(framePath('/images/giro/giro-{n}.webp', 35)).toBe('/images/giro/giro-36.webp');
  });
});
