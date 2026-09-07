export const MEMBER_EMAIL_DOMAINS = ["iitb.ac.in", "iitbombay.org"];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function memberDomainsLabel() {
  return MEMBER_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ");
}

export function isMemberEmail(email) {
  const e = normalizeEmail(email);
  return MEMBER_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d}`));
}

/** Self-serve signup: IITB addresses only. Login lets the API decide. */
export function loginEmailError(email) {
  if (isMemberEmail(email)) return null;
  return `Only ${memberDomainsLabel()} emails can register.`;
}
