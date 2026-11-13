import {describe,it,expect} from "vitest";
import {validUuid,validAgentRequest} from "./request-validation.mjs";
const workspaceId="af56b7d1-c390-4175-ae52-b8c7b0c0a8eb";
const otherId="d49dbf0e-5321-47b5-8f72-6eb85ba802b3";
describe("private CRM chat request validation",()=>{
 it("accepts real Supabase UUIDs and a new conversation",()=>{
   expect(validUuid(workspaceId)).toBe(true);
   expect(validAgentRequest({workspaceId,conversationId:null,message:"Hola, busco 3 celulares resistentes"})).toBe(true);
 });
 it("accepts a valid existing conversation ID",()=>{
   expect(validAgentRequest({workspaceId,conversationId:otherId,message:"Mejor solo 2"})).toBe(true);
 });
 it("rejects old six-group UUID regression",()=>{
   expect(validUuid("af56b7d1-c390-4175-ae52-b8c7-b0c0-a8eb12345678")).toBe(false);
 });
 it("rejects invalid or missing identifiers",()=>{
   expect(validAgentRequest({workspaceId:"abc",message:"Hola"})).toBe(false);
   expect(validAgentRequest({workspaceId,conversationId:"abc",message:"Hola"})).toBe(false);
   expect(validAgentRequest({message:"Hola"})).toBe(false);
 });
 it("validates customer text independently",()=>{
   expect(validAgentRequest({workspaceId,message:"x"})).toBe(false);
   expect(validAgentRequest({workspaceId,message:" ".repeat(10)})).toBe(false);
   expect(validAgentRequest({workspaceId,message:"x".repeat(801)})).toBe(false);
   expect(validAgentRequest({workspaceId,message:"x".repeat(800)})).toBe(true);
 });
});
