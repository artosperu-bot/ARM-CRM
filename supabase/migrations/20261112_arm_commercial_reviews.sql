-- ARM commercial evidence: verified price and saleable inventory are independent.
-- No ERP writes, no sale activation, no price approvals by migration.
create table if not exists public.arm_commercial_reviews(
 workspace_id uuid not null,
 partnumber text not null,
 review_state text not null default 'pending'
   check(review_state in ('pending','approved','revoked')),
 reviewer_id uuid references auth.users(id),
 review_note text not null default '',
 price_pen numeric(14,2),
 price_source_ref text,
 price_reviewed_at timestamptz,
 price_expires_at timestamptz,
 saleable_units integer check(saleable_units is null or saleable_units>=0),
 stock_source_ref text,
 stock_source_updated_at timestamptz,
 stock_reviewed_at timestamptz,
 stock_expires_at timestamptz,
 channels_reconciled_at timestamptz,
 commitments_reconciled_at timestamptz,
 reservations_reconciled_at timestamptz,
 last_reviewed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(workspace_id,partnumber),
 foreign key(workspace_id,partnumber) references public.arm_products(workspace_id,partnumber) on delete cascade,
 constraint arm_review_price_complete check(
    price_reviewed_at is null or (
     price_pen is not null and price_pen > 0 and length(btrim(coalesce(price_source_ref,'')))>=8
     and price_expires_at>price_reviewed_at
     and price_expires_at<=price_reviewed_at+interval '6 hours')),
 constraint arm_review_stock_complete check(
    stock_reviewed_at is null or (
     saleable_units is not null and length(btrim(coalesce(stock_source_ref,'')))>=8
     and stock_source_updated_at is not null
     and stock_expires_at>stock_reviewed_at
     and stock_expires_at<=stock_reviewed_at+interval '15 minutes'
     and channels_reconciled_at is not null
     and commitments_reconciled_at is not null
     and reservations_reconciled_at is not null)),
 constraint arm_review_approval check(
    review_state<>'approved' or
    (reviewer_id is not null and length(btrim(review_note))>=8
    and (price_reviewed_at is not null or stock_reviewed_at is not null)))
);
comment on table public.arm_commercial_reviews is
 'Operator-reviewed direct-channel commercial evidence. Empty means unverified. Physical ERP stock alone NEVER authorizes saleable status.';
create index if not exists arm_commercial_reviews_approved
  on public.arm_commercial_reviews(workspace_id,review_state,price_expires_at,stock_expires_at);
alter table public.arm_commercial_reviews enable row level security;
revoke all on public.arm_commercial_reviews from public,anon,authenticated;
grant select on public.arm_commercial_reviews to authenticated;
create policy arm_commercial_reviews_read on public.arm_commercial_reviews
 for select to authenticated
 using (exists(select 1 from public.arm_workspaces w
    where w.id=arm_commercial_reviews.workspace_id));
-- Only trusted backend service access can prepare reviewed evidence; UI has no write grant.
grant select,insert,update,delete on public.arm_commercial_reviews to service_role;
