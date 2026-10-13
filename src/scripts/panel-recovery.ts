import { site } from '../config/site';
import { checkNewPassword, parseRecoveryHash, type Session } from '../lib/auth';

/**
 * "Olvidé mi contraseña" del panel. Pide a Supabase que envíe un enlace al correo y, al volver
 * desde ese enlace, deja elegir una contraseña nueva. Supabase solo envía el correo si la cuenta
 * existe, pero la pantalla dice lo mismo en los dos casos para no revelar qué correos son de
 * administradores.
 */

const { supabaseUrl, publishableKey } = site.panel;

function show(node: HTMLElement, kind: 'success' | 'error', text: string): void {
  node.textContent = text;
  node.dataset.kind = kind;
  node.hidden = false;
}

interface Options {
  login: HTMLFormElement;
  /** Se llama con la sesión nueva cuando la contraseña quedó cambiada. */
  onSession: (session: Session) => void;
}

export function initRecovery({ login, onSession }: Options): void {
  const open = document.getElementById('panel-forgot');
  const recover = document.getElementById('panel-recover');
  const recoverStatus = document.getElementById('panel-recover-status');
  const back = document.getElementById('panel-recover-back');
  const reset = document.getElementById('panel-reset');
  const resetStatus = document.getElementById('panel-reset-status');
  const loginStatus = document.getElementById('panel-login-status');
  if (
    !open ||
    !(recover instanceof HTMLFormElement) ||
    !recoverStatus ||
    !back ||
    !(reset instanceof HTMLFormElement) ||
    !resetStatus ||
    !loginStatus
  ) {
    return;
  }

  const toLogin = () => {
    recover.hidden = true;
    reset.hidden = true;
    login.hidden = false;
  };

  open.addEventListener('click', () => {
    login.hidden = true;
    recoverStatus.hidden = true;
    recover.hidden = false;
    const email = recover.querySelector<HTMLInputElement>('input[name="email"]');
    const typed = login.querySelector<HTMLInputElement>('input[name="email"]')?.value ?? '';
    if (email) {
      email.value = typed;
      email.focus();
    }
  });
  back.addEventListener('click', toLogin);

  recover.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!recover.reportValidity()) return;
    const email = String(new FormData(recover).get('email') ?? '').trim();
    const submit = recover.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const redirect = `${location.origin}${location.pathname}`;
      const res = await fetch(
        `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,
        {
          method: 'POST',
          headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      if (res.status === 429) {
        show(
          recoverStatus,
          'error',
          'Ya pediste varios enlaces. Espera una hora y vuelve a intentar.',
        );
        return;
      }
      if (!res.ok && res.status >= 500) throw new Error(String(res.status));
      show(
        recoverStatus,
        'success',
        'Si ese correo es de un administrador, te llegará un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.',
      );
    } catch {
      show(recoverStatus, 'error', 'No se pudo enviar el enlace. Revisa tu conexión.');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  // Vuelta desde el enlace del correo.
  const result = parseRecoveryHash(location.hash);
  if (result.kind === 'ninguno') return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  if (result.kind === 'error') {
    show(
      loginStatus,
      'error',
      result.expired
        ? 'El enlace venció o ya se usó. Pide uno nuevo con "¿Olvidaste tu contraseña?".'
        : 'No se pudo abrir el enlace. Pide uno nuevo con "¿Olvidaste tu contraseña?".',
    );
    return;
  }

  login.hidden = true;
  reset.hidden = false;
  reset.querySelector<HTMLInputElement>('input')?.focus();
  reset.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(reset);
    const error = checkNewPassword(
      String(data.get('password') ?? ''),
      String(data.get('repeat') ?? ''),
    );
    if (error) return show(resetStatus, 'error', error);
    const submit = reset.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${result.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: String(data.get('password')) }),
      });
      if (res.status === 401 || res.status === 403) {
        reset.hidden = true;
        login.hidden = false;
        show(
          loginStatus,
          'error',
          'El enlace venció. Pide uno nuevo con "¿Olvidaste tu contraseña?".',
        );
        return;
      }
      if (res.status === 422) {
        show(resetStatus, 'error', 'Elige una contraseña distinta y más segura.');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      reset.reset();
      reset.hidden = true;
      onSession(result.session);
    } catch {
      show(resetStatus, 'error', 'No se pudo cambiar la contraseña. Revisa tu conexión.');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
