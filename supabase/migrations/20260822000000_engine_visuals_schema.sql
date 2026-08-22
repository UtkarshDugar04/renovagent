-- Visual engine outputs. project_artifacts gains an optional image column
-- for the single-generated-visual engines (Spatial's floor plan); exactly
-- one of content/image_storage_path is required, enforced in the tool
-- handler rather than a DB constraint, matching how other optional-shape
-- validation already works in this codebase.
--
-- Preference (accumulating moodboard, per-image reactions) and Design Agent
-- (multiple images per option) don't fit a single opaque content column, so
-- they get dedicated child tables — mirroring the existing
-- design_option_feedback precedent (child of design_options, no project_id
-- column of its own, RLS joins through the parent).

alter table project_artifacts
  add column image_storage_path text,
  alter column content drop not null;

create table preference_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  caption text,
  room_or_theme text,
  created_at timestamptz not null default now()
);

create index preference_images_project_idx on preference_images (project_id, created_at desc);

create table preference_image_reactions (
  id uuid primary key default gen_random_uuid(),
  preference_image_id uuid not null references preference_images(id) on delete cascade,
  reaction text not null check (reaction in ('thumbs_up', 'thumbs_down', 'save')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index preference_image_reactions_image_idx on preference_image_reactions (preference_image_id);

create table design_option_images (
  id uuid primary key default gen_random_uuid(),
  design_option_id uuid not null references design_options(id) on delete cascade,
  storage_path text not null,
  angle text,
  materials_shown text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index design_option_images_option_idx on design_option_images (design_option_id);

alter table preference_images enable row level security;
alter table preference_image_reactions enable row level security;
alter table design_option_images enable row level security;

create policy "members can read preference_images" on preference_images
  for select using (is_project_member(project_id));
create policy "members can write preference_images" on preference_images
  for insert with check (is_project_member(project_id));

create policy "members can read preference_image_reactions" on preference_image_reactions
  for select using (
    exists (select 1 from preference_images pi where pi.id = preference_image_id and is_project_member(pi.project_id))
  );
create policy "members can write preference_image_reactions" on preference_image_reactions
  for insert with check (
    exists (select 1 from preference_images pi where pi.id = preference_image_id and is_project_member(pi.project_id))
  );

create policy "members can read design_option_images" on design_option_images
  for select using (
    exists (select 1 from design_options d where d.id = design_option_id and is_project_member(d.project_id))
  );
create policy "members can write design_option_images" on design_option_images
  for insert with check (
    exists (select 1 from design_options d where d.id = design_option_id and is_project_member(d.project_id))
  );

alter publication supabase_realtime add table preference_images;
alter publication supabase_realtime add table preference_image_reactions;
alter publication supabase_realtime add table design_option_images;
