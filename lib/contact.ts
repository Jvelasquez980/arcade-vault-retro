export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export type ContactValues = { name: string; email: string; message: string };

export type ContactState =
  | { status: "idle"; values: ContactValues }
  | { status: "success"; name: string }
  | { status: "invalid"; values: ContactValues }
  | { status: "error"; values: ContactValues; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Espera valores ya recortados (trim).
export function validateContact({ name, email, message }: ContactValues): boolean {
  return (
    name.length > 0 &&
    name.length <= CONTACT_LIMITS.name &&
    email.length > 0 &&
    email.length <= CONTACT_LIMITS.email &&
    EMAIL_RE.test(email) &&
    message.length > 0 &&
    message.length <= CONTACT_LIMITS.message
  );
}
