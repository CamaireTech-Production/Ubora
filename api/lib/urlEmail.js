export function resolveBaseUrl(role) {
  const fallback = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  return (process.env.APP_BASE_URL || fallback).replace(/\/$/, '');
}

export function buildAbsoluteUrl(role, redirectPath) {
  const base = resolveBaseUrl(role);
  const path = (redirectPath || '/').startsWith('/') ? redirectPath : `/${redirectPath || ''}`;
  return `${base}${path}`;
}

export function renderEmailTemplate({ logoUrl, title, body, ctaLabel, ctaHref, footerNote }) {
  const safeLogo = logoUrl || (process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL.replace(/\/$/, '')}/fav-icons/android-icon-192x192.png` : undefined);
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;margin:0;padding:24px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
      <tr>
        <td style="background:#0f172a;padding:16px 20px;display:flex;align-items:center;">
          ${safeLogo ? `<img src="${safeLogo}" alt="Ubora" width="28" height="28" style="display:inline-block;border-radius:6px;margin-right:10px;"/>` : ''}
          <span style="color:#e2e8f0;font-size:16px;font-weight:600;">Ubora</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 20px;">
          <h1 style="margin:0 0 8px 0;color:#0f172a;font-size:18px;line-height:1.3;">${title || 'Notification'}</h1>
          <p style="margin:0 0 16px 0;color:#334155;font-size:14px;line-height:1.6;">${body || ''}</p>
          ${ctaHref ? `<a href="${ctaHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">${ctaLabel || 'Ouvrir'}</a>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
          ${footerNote || 'Cet email vous a été envoyé par Ubora.'}
        </td>
      </tr>
    </table>
  </div>`;
}


