export const MEMBER_EMAIL_DOMAIN = "iitb.ac.in";
export const ADMIN_EMAIL = "ideas.iitb@gmail.com";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAllowedLoginEmail(email) {
  const e = normalizeEmail(email);
  return e === ADMIN_EMAIL || e.endsWith(`@${MEMBER_EMAIL_DOMAIN}`);
}

export function loginEmailError(email) {
  if (isAllowedLoginEmail(email)) return null;
  return `Only @${MEMBER_EMAIL_DOMAIN} emails can register or log in. Admin access is limited to ${ADMIN_EMAIL}.`;
}
