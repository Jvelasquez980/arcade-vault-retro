// Origen fijo del sitio. Nunca se deriva de Host/x-forwarded-host (los controla el cliente).
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("NEXT_PUBLIC_SITE_URL no definida");
}
