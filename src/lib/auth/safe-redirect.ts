/**
 * Limita `next` a una ruta relativa dentro de la propia app.
 *
 * `next` llega desde un parámetro de URL público (?next=...) en enlaces de login,
 * registro e invitación: es responsabilidad de cada punto de entrada validarlo antes
 * de usarlo en una redirección, porque un valor como "https://evil.example" o
 * "//evil.example" (protocol-relative) reenviaría a la víctima fuera del sitio justo
 * después de autenticarse (open redirect / phishing).
 */
export function safeNextPath(candidate: string | null | undefined): string {
  if (!candidate) return "/app";
  // Debe empezar por una única "/" y no por "//" ni "/\" (esos dos los interpretan
  // algunos navegadores como protocol-relative, saliendo del origen actual).
  if (!/^\/(?!\/|\\)/.test(candidate)) return "/app";
  return candidate;
}
