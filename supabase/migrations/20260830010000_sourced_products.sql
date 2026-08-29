-- design_options.sourcing_status already records WHETHER an option is
-- grounded in real sourcing (grounded/indicative/ungrounded), but nothing
-- records WHAT the Sourcing Agent actually found — the real vendor,
-- product, price, and link it used to ground that status. This table is
-- that record: one row per real product the Sourcing Agent surfaced for
-- one design option, written by the Design Agent (or Design Revision
-- Agent) once it has a real designOptionId — see record-sourced-products.ts
-- for why Sourcing itself can't write this directly (it never receives the
-- option id; that's created by recordProposedDesignPackage, which runs
-- after Sourcing's work, not before).

create table sourced_products (
  id uuid primary key default gen_random_uuid(),
  design_option_id uuid not null references design_options(id) on delete cascade,
  vendor_name text not null,
  product_name text not null,
  product_url text,
  price numeric,
  currency text not null default 'INR',
  notes text,
  created_at timestamptz not null default now()
);

create index sourced_products_design_option_id_idx on sourced_products(design_option_id);

alter table sourced_products enable row level security;

create policy "members can read sourced_products" on sourced_products
  for select using (
    exists (select 1 from design_options d where d.id = design_option_id and is_project_member(d.project_id))
  );

create policy "staff can read all sourced_products" on sourced_products
  for select using (is_staff());
create policy "staff can write all sourced_products" on sourced_products
  for insert with check (is_staff());

alter publication supabase_realtime add table sourced_products;
