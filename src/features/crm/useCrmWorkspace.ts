
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { resolveAccess, type CrmProfile, type CrmRole } from "../auth/access";
import type { Channel, Contact, Deal, DealStage, Product, Followup } from "../../types";

export type CrmStatus = "checking" | "signed-out" | "blocked" | "no-workspace" | "ready" | "error";
type Workspace = { id: string; name: string };
type ContactRow = {
  id: string; display_name: string; phone: string | null; email: string | null;
  source: Channel | "manual"; notes: string | null; created_at: string;
};
type DealRow = {
  id: string; contact_id: string; title: string; stage: DealStage | "perdido";
  amount_pen: number | null; created_at: string;
};
type FollowupRow = { id: string; contact_id: string; deal_id: string | null; due_at: string; status: "pending" | "completed" | "cancelled"; description: string };
type ProductRow = {
  partnumber: string; title: string; brand: string; stock_erp: number | null;
  price_pen: number | null; verified_at: string | null;
};
function channel(value: Channel | "manual"): Channel {
  return value === "manual" ? "web" : value;
}

export function useCrmWorkspace(enabled: boolean) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<CrmRole | null>(null);
  const [status, setStatus] = useState<CrmStatus>("checking");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async (current: Session, active = true) => {
    if (!supabase) return;
    try {
      const email = current.user.email?.trim().toLowerCase() || "";
      if (!email) {
        if (active) { setStatus("blocked"); setWorkspace(null); setRole(null); }
        return;
      }
      const { data: profile, error: profileError } = await supabase.from("crm_usuarios")
        .select("email,nombre,rol,activo").eq("email", email).maybeSingle<CrmProfile>();
      if (profileError) throw profileError;
      const resolved = resolveAccess(email, profile);
      if (!resolved.allowed) {
        if (active) { setStatus("blocked"); setWorkspace(null); setContacts([]); setDeals([]); setProducts([]); setFollowups([]); setRole(null); }
        return;
      }
      if (active) setRole(resolved.role);
      const { data: ws, error: wsError } = await supabase.from("arm_workspaces")
        .select("id,name").order("created_at", { ascending: true }).limit(1);
      if (wsError) throw wsError;
      if (!active) return;
      if (!ws || ws.length === 0) {
        setWorkspace(null); setContacts([]); setDeals([]); setProducts([]); setFollowups([]); setStatus("no-workspace");
        return;
      }
      const selected = ws[0] as Workspace;
      const [contactResponse, dealResponse, productResponse, followupResponse] = await Promise.all([
        supabase.from("arm_contacts").select("id,display_name,phone,email,source,notes,created_at")
          .eq("workspace_id", selected.id).order("created_at", { ascending: false }).limit(500),
        supabase.from("arm_deals").select("id,contact_id,title,stage,amount_pen,created_at")
          .eq("workspace_id", selected.id).order("created_at", { ascending: false }).limit(500),
        supabase.from("arm_products").select("partnumber,title,brand,stock_erp,price_pen,verified_at")
          .eq("workspace_id", selected.id).order("title", { ascending: true }).limit(500),
        supabase.from("arm_followups").select("id,contact_id,deal_id,due_at,status,description")
          .eq("workspace_id", selected.id).order("due_at", { ascending: true }).limit(500),
      ]);
      if (contactResponse.error) throw contactResponse.error;
      if (dealResponse.error) throw dealResponse.error;
      if (productResponse.error) throw productResponse.error;
      if (followupResponse.error) throw followupResponse.error;
      if (!active) return;
      setWorkspace(selected);
      setContacts(((contactResponse.data || []) as ContactRow[]).map((c) => ({
        id: c.id, name: c.display_name, phone: c.phone || "", email: c.email || "",
        source: channel(c.source), interest: c.notes || "Sin observaciones", createdAt: c.created_at,
      })));
      setDeals(((dealResponse.data || []) as DealRow[]).map((d) => ({
        id: d.id, contactId: d.contact_id, title: d.title,
        stage: d.stage === "perdido" ? "nuevo" : d.stage,
        amount: d.amount_pen, channel: channel(((contactResponse.data || []) as ContactRow[])
          .find((c) => c.id === d.contact_id)?.source || "manual"), lastActivity: d.created_at,
      })));
      setProducts(((productResponse.data || []) as ProductRow[]).map((p) => ({
        partnumber: p.partnumber, title: p.title, brand: p.brand,
        category: "Catálogo", status: "pendiente_erp",
        price: p.price_pen, stock: p.stock_erp,
      })));
      setFollowups(((followupResponse.data || []) as FollowupRow[]).map((f) => ({
        id: f.id, contactId: f.contact_id, dealId: f.deal_id, dueAt: f.due_at,
        status: f.status, description: f.description,
      })));
      setStatus("ready"); setError("");
    } catch (cause) {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "No fue posible consultar CRM.");
      setStatus("error");
    }
    void current;
  }, []);

  useEffect(() => {
    if (!enabled || !supabase) return;
    let active = true;
    const client = supabase;
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) { setError(authError.message); setStatus("error"); return; }
      setSession(data.session);
      if (data.session) void refresh(data.session, active);
      else setStatus("signed-out");
    });
    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED") { setSession(nextSession); return; }
      setSession(nextSession);
      if (!nextSession) {
        setWorkspace(null); setContacts([]); setDeals([]); setProducts([]); setRole(null); setStatus("signed-out");
      } else {
        // Schedule async data queries out of the auth callback, avoiding lock contention.
        queueMicrotask(() => { if (active) void refresh(nextSession, active); });
      }
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, [enabled, refresh]);

  async function createWorkspace(name: string) {
    if (!supabase || !session) throw new Error("Debes iniciar sesión.");
    const { error: insertError } = await supabase.from("arm_workspaces")
      .insert({ name: name.trim(), owner_id: session.user.id });
    if (insertError) throw insertError;
    await refresh(session);
  }
  async function createContact(name: string, interest: string, source: Channel = "web", phone = "", email = "") {
    if (!supabase || !workspace || !session) throw new Error("No hay un espacio comercial activo.");
    const { error: insertError } = await supabase.from("arm_contacts").insert({
      workspace_id: workspace.id, display_name: name.trim(),
      notes: interest.trim() || null, source: source === "web" ? "manual" : source,
      phone: phone.trim() || null, email: email.trim().toLowerCase() || null,
    });
    if (insertError) throw insertError;
    await refresh(session);
  }
  async function createDeal(contactId: string, title: string) {
    if (!supabase || !workspace || !session) throw new Error("No hay un espacio comercial activo.");
    const { error: insertError } = await supabase.from("arm_deals").insert({
      workspace_id: workspace.id, contact_id: contactId, title: title.trim(), stage: "nuevo",
    });
    if (insertError) throw insertError;
    await refresh(session);
  }
  async function updateDealStage(id: string, stage: DealStage) {
    if (!supabase || !workspace || !session) throw new Error("No hay un espacio comercial activo.");
    const { data, error: updateError } = await supabase.from("arm_deals")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", id).eq("workspace_id", workspace.id).select("id");
    if (updateError) throw updateError;
    if (!data?.length) throw new Error("La oportunidad no pudo actualizarse. Verifica tus permisos.");
    await refresh(session);
  }

  async function createFollowup(contactId: string, description: string, dueAt: string) {
    if (!supabase || !workspace || !session) throw new Error("No hay un espacio comercial activo.");
    const trimmed = description.trim();
    if (trimmed.length < 3) throw new Error("Describe el seguimiento.");
    const date = new Date(dueAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Selecciona una fecha futura.");
    const { error: insertError } = await supabase.from("arm_followups").insert({
      workspace_id: workspace.id, contact_id: contactId, description: trimmed,
      due_at: date.toISOString(), status: "pending",
    });
    if (insertError) throw insertError;
    await refresh(session);
  }
  async function completeFollowup(id: string) {
    if (!supabase || !workspace || !session) throw new Error("No hay un espacio comercial activo.");
    const { data, error: updateError } = await supabase.from("arm_followups").update({ status: "completed" })
      .eq("workspace_id", workspace.id).eq("id", id).eq("status", "pending").select("id");
    if (updateError) throw updateError;
    if (!data?.length) throw new Error("El seguimiento ya cambió o no tienes permiso.");
    await refresh(session);
  }

  return {
    session, role, status, workspace, contacts, deals, products, followups, error,
    refresh: () => session ? refresh(session) : Promise.resolve(),
    createWorkspace, createContact, createDeal, updateDealStage, createFollowup, completeFollowup,
    signOut: () => supabase?.auth.signOut(),
  };
}
