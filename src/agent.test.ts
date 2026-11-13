import { describe, expect, it } from "vitest";
import { createSafeDraft, detectBuyerIntent } from "./agent";

describe("clasificación y borradores seguros", () => {
  it("prioriza reclamos y garantías", () => {
    expect(detectBuyerIntent("Tengo una falla de garantía")).toBe("posventa");
  });
  it("detecta disponibilidad sin inventar stock", () => {
    expect(detectBuyerIntent("¿Tienen stock del Ulefone?")).toBe("disponibilidad");
    expect(createSafeDraft("¿Tienen stock del Ulefone?")).toContain("confirmar");
  });
  it("no inventa precios", () => {
    const draft = createSafeDraft("¿Cuánto cuesta esta laptop?");
    expect(draft).toContain("Verificaré");
    expect(draft).not.toMatch(/S\/\s?\d+/);
  });
  it("responde una consulta general", () => {
    expect(detectBuyerIntent("Hola, quiero información")).toBe("consulta");
  });
});
