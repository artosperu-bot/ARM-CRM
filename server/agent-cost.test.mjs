import { describe,expect,it } from "vitest";
import { estimateUsd } from "./agent-cost.mjs";
describe("OpenAI-only token cost accounting",()=>{
 it("does not count cached input tokens twice",()=>{
  expect(estimateUsd(1000,100,200)).toBe(0.001065);
 });
 it("zero usage yields zero estimate",()=>{
  expect(estimateUsd(0,0,0)).toBe(0);
 });
 it("never charges more cached tokens than total input",()=>{
  expect(estimateUsd(100,0,200)).toBe(0.0000075);
 });
});
