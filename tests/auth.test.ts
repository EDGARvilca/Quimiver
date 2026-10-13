import { describe, expect, it } from 'vitest';
import { checkNewPassword, parseRecoveryHash } from '../src/lib/auth';

describe('recuperar contraseña del panel', () => {
  it('lee la sesión que trae el enlace del correo', () => {
    const r = parseRecoveryHash(
      '#access_token=aaa&expires_at=1&expires_in=3600&refresh_token=bbb&token_type=bearer&type=recovery',
      1_000,
    );
    expect(r).toEqual({
      kind: 'recuperacion',
      session: { access_token: 'aaa', refresh_token: 'bbb', expires_at: 1_000 + 3_540_000 },
    });
  });

  it('distingue un enlace vencido de otros errores', () => {
    expect(
      parseRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=x'),
    ).toEqual({ kind: 'error', expired: true });
    expect(parseRecoveryHash('#error=server_error')).toEqual({ kind: 'error', expired: false });
  });

  it('ignora otros enlaces', () => {
    expect(parseRecoveryHash('')).toEqual({ kind: 'ninguno' });
    expect(parseRecoveryHash('#faq')).toEqual({ kind: 'ninguno' });
    expect(parseRecoveryHash('#access_token=a&refresh_token=b&type=signup')).toEqual({
      kind: 'ninguno',
    });
  });

  it('pide 8 caracteres y que las dos coincidan', () => {
    expect(checkNewPassword('corta', 'corta')).toMatch(/al menos 8/);
    expect(checkNewPassword('larga123', 'larga124')).toMatch(/no coinciden/);
    expect(checkNewPassword('larga123', 'larga123')).toBeNull();
  });
});
