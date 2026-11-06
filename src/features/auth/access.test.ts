import { describe, expect, it } from "vitest";
import { resolveAccess } from "./access";
const profile = { email: "admin@ejemplo.test", nombre: "Admin", rol: "ADMIN" as const, activo: true };
describe("acceso interno solo usuarios aprobados", () => {
  it("permite correo activo autorizado sin importar mayúsculas", () => {
    expect(resolveAccess("ADMIN@EJEMPLO.TEST", profile)).toEqual({ allowed: true, role: "ADMIN", name: "Admin" });
  });
  it("bloquea correo no incluido en la lista", () => {
    expect(resolveAccess("extra@ejemplo.test", profile)).toEqual({ allowed: false });
  });
  it("bloquea cuentas desactivadas y perfiles inexistentes", () => {
    expect(resolveAccess(profile.email, { ...profile, activo: false })).toEqual({ allowed: false });
    expect(resolveAccess(profile.email, null)).toEqual({ allowed: false });
  });
  it("bloquea falta de identidad", () => {
    expect(resolveAccess(null, profile)).toEqual({ allowed: false });
  });
});
