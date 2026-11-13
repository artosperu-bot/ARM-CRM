-- Structured, explainable, non-predictive lead intelligence.
-- All automatic WhatsApp outbound followups stay disabled. Only trusted server
-- with a service role may write; authenticated workspace members may read.
create table if not exists public.arm_lead_insights (
 thread_id uuid primary key,
 workspace_id uuid not null,
 contact_id uuid not null,
 source_mode text not null default 'sandbox' check (source_mode in ('sandbox','real')),
 intent text not null default 'consulta_general' check(intent in
  ('consulta_general','consulta_producto','comparacion','cotizacion','compra','objecion','atencion_humana','no_contactar')),
 priority text not null default 'baja' check(priority in ('alta','media','baja','sin_contacto')),
 score integer not null default 0 check(score between 0 and 100),
 is_b2b boolean not null default false,
 quantity_min integer check(quantity_min is null or quantity_min between 1 and 999),
 signals text[] not null default '{}'::text[],
 requires_human boolean not null default false,
 opt_out boolean not null default false,
 followup_suppressed boolean not null default true check(followup_suppressed=true),
 suppression_reason text not null default 'sin_consentimiento_de_seguimiento',
 next_action text not null default 'Responder la consulta',
 last_message_id text,
 evaluated_at timestamptz not null default now(),
 constraint arm_lead_insights_thread_fkey foreign key(workspace_id,thread_id)
    references public.arm_threads(workspace_id,id) on delete cascade,
 constraint arm_lead_insights_contact_fkey foreign key(workspace_id,contact_id)
    references public.arm_contacts(workspace_id,id)
);
create index if not exists arm_lead_insights_filter on public.arm_lead_insights
 (workspace_id,source_mode,priority,score desc,evaluated_at desc);
alter table public.arm_lead_insights enable row level security;
revoke all on public.arm_lead_insights from public,anon,authenticated;
grant select on public.arm_lead_insights to authenticated;
drop policy if exists arm_lead_insights_read on public.arm_lead_insights;
create policy arm_lead_insights_read on public.arm_lead_insights
 for select to authenticated using (
  exists(
   select 1 from public.arm_workspaces w
    where w.id=arm_lead_insights.workspace_id and w.owner_id=(select auth.uid())
  ) or exists(
   select 1 from public.arm_memberships m
    where m.workspace_id=arm_lead_insights.workspace_id and m.user_id=(select auth.uid())
  )
 );
comment on table public.arm_lead_insights is
 'Explainable sales triage, not purchase probability. No automatic outreach permission; sandbox results never become real deals.';
