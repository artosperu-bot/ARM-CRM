-- ARM-CRM: product-agnostic catalog search + product fact evidence.
-- No prices, stock, customer conversations or outbound channels are changed.
-- Product = model/family; partnumber = exact sellable SKU/variant.
alter table public.arm_products add column if not exists category_path text[] not null default '{}'::text[];
alter table public.arm_products add column if not exists search_terms text[] not null default '{}'::text[];
alter table public.arm_products add column if not exists family_key text;
alter table public.arm_products add column if not exists variant_options jsonb not null default '{}'::jsonb;
create index if not exists arm_products_title_trgm_idx
  on public.arm_products using gin ((lower(title)) public.gin_trgm_ops);
create index if not exists arm_products_partnumber_trgm_idx
  on public.arm_products using gin ((lower(partnumber)) public.gin_trgm_ops);
create index if not exists arm_products_search_terms_idx
  on public.arm_products using gin (search_terms);
create index if not exists arm_products_category_path_idx
  on public.arm_products using gin (category_path);
comment on column public.arm_products.family_key is 'Optional model family grouping. Exact partnumber identifies sellable variant; never infer SKU equivalence from text.';
comment on column public.arm_products.variant_options is 'Verified variant details, e.g. storage/colour/licence edition, without presuming identical stock or price.';
comment on column public.arm_products.search_terms is 'Reviewed search keywords and synonyms for a product, not instructions for the AI.';
create table if not exists public.arm_product_facts (
 workspace_id uuid not null,
 partnumber text not null,
 fact_key text not null check(fact_key ~ '^[a-z][a-z0-9_]{1,63}$'),
 fact_value jsonb not null,
 source_type text not null check(source_type in ('manufacturer','official_manual','supplier','erp','reviewed_internal')),
 source_url text,
 review_status text not null default 'pending' check(review_status in ('pending','verified','rejected')),
 reviewed_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(workspace_id,partnumber,fact_key),
 foreign key(workspace_id,partnumber)
  references public.arm_products(workspace_id,partnumber) on delete cascade,
 constraint arm_product_fact_verified_provenance
 check(review_status <> 'verified' or (reviewed_at is not null and
   (source_url is not null or source_type in ('erp','reviewed_internal'))))
);
alter table public.arm_product_facts enable row level security;
revoke all on public.arm_product_facts from PUBLIC,anon,authenticated;
comment on table public.arm_product_facts is
 'Reviewable and expirable facts for ANY product category. Only reviewed, nonexpired facts may reach ALEX.';
create or replace function public.arm_search_catalog(
 p_workspace_id uuid,p_query text,p_max_results int default 24
)
returns table (
 id uuid, workspace_id uuid, title text, brand text, partnumber text, attributes jsonb,
 price_pen numeric, stock_erp integer, verified_at timestamptz,
 category_path text[], search_terms text[], family_key text,variant_options jsonb,
 search_rank double precision
)
language sql stable security invoker
set search_path = ''
as $function$
with query_parts as (
  select btrim(regexp_replace(
   regexp_replace(lower(left(coalesce(p_query,''),180)), '[^[:alnum:] ]+', ' ', 'g'),
   '[[:space:]]+', ' ', 'g')) as q
), search_words as (
  select q,
     array(select token from unnest(string_to_array(q,' ')) token where length(token)>=2) as qwords
  from query_parts
), ranked as (
 select p.id,p.workspace_id,p.title,p.brand,p.partnumber,p.attributes,
        p.price_pen,p.stock_erp,p.verified_at,p.category_path,p.search_terms,
        p.family_key,p.variant_options,
        (
         (case when lower(p.partnumber)=q.q then 500 else 0 end)
         +(case when length(q.q)>=3 and lower(p.partnumber) like '%'||q.q||'%' then 160 else 0 end)
         +(case when length(q.q)>=3 and lower(p.title) like '%'||q.q||'%' then 100 else 0 end)
         +(select count(*)*18 from unnest(q.qwords) token where
            lower(p.title) like '%'||token||'%' or lower(p.partnumber) like '%'||token||'%'
            or lower(p.brand) like '%'||token||'%')
         + public.similarity(lower(p.title),q.q)*35
         + public.word_similarity(q.q,lower(p.title))*25
         + (case when p.search_terms && q.qwords then 60 else 0 end)
         + (case when p.category_path && q.qwords then 40 else 0 end)
        )::double precision as score
 from public.arm_products p cross join search_words q
 where p.workspace_id=p_workspace_id and length(q.q)>=2
 and (
    lower(p.title) % q.q
    or lower(p.title) like '%'||q.q||'%'
    or lower(p.partnumber) like '%'||q.q||'%'
    or lower(p.brand) like '%'||q.q||'%'
    or p.search_terms && q.qwords
    or p.category_path && q.qwords
    or public.word_similarity(q.q,lower(p.title))>0.40
    or exists(select 1 from unnest(q.qwords) token where length(token)>=4 and
        (lower(p.title) like '%'||token||'%' or lower(p.partnumber) like '%'||token||'%'))
 )
)
select ranked.id,ranked.workspace_id,ranked.title,ranked.brand,ranked.partnumber,ranked.attributes,
       ranked.price_pen,ranked.stock_erp,ranked.verified_at,ranked.category_path,ranked.search_terms,
       ranked.family_key,ranked.variant_options,ranked.score
from ranked
order by ranked.score desc, ranked.partnumber asc
limit greatest(1,least(30,coalesce(p_max_results,24)));
$function$;
revoke all on function public.arm_search_catalog(uuid,text,int) from PUBLIC,anon,authenticated;
grant execute on function public.arm_search_catalog(uuid,text,int) to service_role;
comment on function public.arm_search_catalog(uuid,text,int) is
 'Bounded workspace-scoped retrieval for trusted ARM server only; never returns cross-tenant catalog.';
-- Tag the four existing test phones, without modifying commercial fields.
update public.arm_products
 set category_path=array['electronica','celulares'],
     search_terms=array['celular','telefono','smartphone','rugged','resistente','ulefone']
 where partnumber in ('ARMOR-22-256G','ARMOR-25TPro-256GB','ARMOR-X12Pro','ARMOR-X13')
   and category_path = '{}'::text[];
