import { describe, expect, it } from "vitest";
import { validateFollowup } from "./followups.domain";
describe("seguimientos CRM", () => {
  it("valida fechas futuras y devuelve ISO", () => {
    expect(validateFollowup("2026-11-05T10:00:00Z", "Llamar al cliente", Date.parse("2026-11-02T10:00:00Z"))).toBe("2026-11-05T10:00:00.000Z");
  });
  it("rechaza fechas antiguas, inválidas y tareas vacías", () => {
    expect(() => validateFollowup("2020-01-01", "Llamar", Date.parse("2026-11-02"))).toThrow();
    expect(() => validateFollowup("invalida", "Llamar")).toThrow();
    expect(() => validateFollowup("2030-11-02", "x")).toThrow();
  });
});
