export type CrmRole = "ADMIN" | "ASESOR";
export type CrmProfile = { email: string; nombre: string | null; rol: CrmRole; activo: boolean };
export type AccessResult = { allowed: false } | { allowed: true; role: CrmRole; name: string };
export function resolveAccess(email: string | null | undefined, profile: CrmProfile | null): AccessResult {
  const normal = email?.trim().toLowerCase();
  if (!normal || !profile || !profile.activo || profile.email.trim().toLowerCase() !== normal) {
    return { allowed: false };
  }
  return { allowed: true, role: profile.rol, name: profile.nombre?.trim() || email!.trim() };
}
