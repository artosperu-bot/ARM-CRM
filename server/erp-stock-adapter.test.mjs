import {describe,it,expect} from "vitest";
import {buildErpObservations} from "./erp-stock-adapter.mjs";
const now=Date.parse("2026-11-05T19:30:00Z");
const map=(id,status="verified_exact")=>({workspace_id:"ws",arm_partnumber:id,erp_partnumber:id==="ARMOR-22-256G"?"ARMOR-22-256GB":id,mapping_status:status});
const data=(partnumber,physical_units=2,source_updated_at="2026-11-05T14:24:00-05:00")=>({partnumber,physical_units,source_updated_at});
describe("ERP PC005 read-only physical inventory gateway",()=>{
 it("preserves stock only in isolated observations, not public product",()=>{
  const r=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X13")],{now});
  expect(r.observations).toHaveLength(1);
  expect(r.observations[0].freshness).toBe("fresh");
  expect(r.observations[0].physical_stock_not_available_stock).toBe(true);
  expect(r.observations[0].price_pen).toBeUndefined();
  expect(r.observations[0].stock_erp).toBeUndefined();
 });
 it("requires explicit alias review for Armor22",()=>{
  const r=buildErpObservations([map("ARMOR-22-256G","candidate")],[data("ARMOR-22-256GB")],{now});
  expect(r.observations[0].freshness).toBe("pending_mapping");
 });
 it("stale stock never becomes fresh",()=>{
  const r=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X13",2,"2026-10-15T14:24:00-05:00")],{now});
  expect(r.observations[0].freshness).toBe("stale");
 });
 it("negative, null or future quantities are anomalies",()=>{
  for(const quantity of [-2,null]){
    const r=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X13",quantity)],{now});
    expect(r.observations[0].freshness).toBe("anomaly");
  }
  const future=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X13",1,"2026-11-06T14:24:00-05:00")],{now});
  expect(future.observations[0].freshness).toBe("anomaly");
 });
 it("duplicate ERP PNs cannot silently be added",()=>{
  const r=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X13"),data("ARMOR-X13")],{now});
  expect(r.observations).toHaveLength(0);
  expect(r.errors[0].reason).toBe("duplicate_pn");
 });
 it("missing mappings are not silently assigned by model-name similarity",()=>{
  const r=buildErpObservations([map("ARMOR-X13")],[data("ARMOR-X12Pro")],{now});
  expect(r.errors[0].reason).toBe("missing_pn");
 });
});
