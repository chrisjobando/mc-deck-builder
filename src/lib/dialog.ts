type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type AlertOptions = {
  title?: string;
};

function buildOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);padding:1rem';
  return el;
}

export function showConfirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const {
    title,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    const overlay = buildOverlay();
    overlay.innerHTML = `
      <div style="background:var(--color-surface);border-radius:0.75rem;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)">
        ${title ? `<h2 style="margin:0 0 0.5rem;font-size:1.125rem;font-weight:600"></h2>` : ''}
        <p style="margin:0 0 1.5rem;color:var(--color-text-muted);font-size:0.925rem;line-height:1.5"></p>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="dlg-cancel" style="padding:0.5rem 1rem;border-radius:0.5rem;border:none;cursor:pointer;background:rgba(255,255,255,0.1);color:inherit;font-size:0.875rem"></button>
          <button id="dlg-confirm" style="padding:0.5rem 1rem;border-radius:0.5rem;border:none;cursor:pointer;background:${danger ? 'var(--color-primary)' : 'var(--color-secondary)'};color:#fff;font-size:0.875rem;font-weight:500"></button>
        </div>
      </div>
    `;
    if (title) overlay.querySelector('h2')!.textContent = title;
    overlay.querySelector('p')!.textContent = message;
    overlay.querySelector('#dlg-cancel')!.textContent = cancelLabel;
    overlay.querySelector('#dlg-confirm')!.textContent = confirmLabel;

    function finish(result: boolean) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    }

    overlay.querySelector('#dlg-cancel')!.addEventListener('click', () => finish(false));
    overlay.querySelector('#dlg-confirm')!.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (overlay.querySelector('#dlg-confirm') as HTMLButtonElement).focus();
  });
}

export function showAlert(message: string, opts: AlertOptions = {}): Promise<void> {
  const { title } = opts;

  return new Promise((resolve) => {
    const overlay = buildOverlay();
    overlay.innerHTML = `
      <div style="background:var(--color-surface);border-radius:0.75rem;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.5)">
        ${title ? `<h2 style="margin:0 0 0.5rem;font-size:1.125rem;font-weight:600"></h2>` : ''}
        <p style="margin:0 0 1.5rem;color:var(--color-text-muted);font-size:0.925rem;line-height:1.5"></p>
        <div style="display:flex;justify-content:flex-end">
          <button id="dlg-ok" style="padding:0.5rem 1rem;border-radius:0.5rem;border:none;cursor:pointer;background:var(--color-secondary);color:#fff;font-size:0.875rem;font-weight:500">OK</button>
        </div>
      </div>
    `;
    if (title) overlay.querySelector('h2')!.textContent = title;
    overlay.querySelector('p')!.textContent = message;

    function finish() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    }

    overlay.querySelector('#dlg-ok')!.addEventListener('click', finish);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (overlay.querySelector('#dlg-ok') as HTMLButtonElement).focus();
  });
}
