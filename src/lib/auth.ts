/**
 * Ayudas puras para la recuperación de contraseña del panel (Supabase Auth).
 * Supabase envía un enlace al correo; al abrirlo vuelve al panel con los datos de la sesión
 * después de "#": `#access_token=...&refresh_token=...&expires_in=3600&type=recovery`,
 * o con un error si el enlace venció: `#error=access_denied&error_code=otp_expired&...`.
 */

export interface Session {
  access_token: string;
  refresh_token: string;
  /** Momento (ms) en que conviene renovar el token, un minuto antes de que venza. */
  expires_at: number;
}

export type RecoveryHash =
  | { kind: 'ninguno' }
  | { kind: 'recuperacion'; session: Session }
  | { kind: 'error'; expired: boolean };

export function parseRecoveryHash(hash: string, now: number = Date.now()): RecoveryHash {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('error') || params.get('error_code')) {
    return { kind: 'error', expired: params.get('error_code') === 'otp_expired' };
  }
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (params.get('type') !== 'recovery' || !access || !refresh) return { kind: 'ninguno' };
  const expiresIn = Number(params.get('expires_in') ?? 3600);
  return {
    kind: 'recuperacion',
    session: {
      access_token: access,
      refresh_token: refresh,
      expires_at: now + (Math.max(Number.isFinite(expiresIn) ? expiresIn : 3600, 120) - 60) * 1000,
    },
  };
}

export const MIN_PASSWORD_LENGTH = 8;

/** Revisa la contraseña nueva y su repetición; devuelve el error o null si está bien. */
export function checkNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== repeat) return 'Las dos contraseñas no coinciden.';
  return null;
}
