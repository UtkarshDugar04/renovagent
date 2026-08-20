-- Rich per-engine outputs (Preference's moodboard, Family's persona, Spatial's
-- rough schematic, Constraint's summary) as content the Yoxa agents generate
-- themselves and write here, rendered on Renovagent's own dashboard — not
-- routed through Yoxa's Output Tool, which has no confirmed way to reach this
-- product at all. Budget's real interactive wallet is deliberately not this
-- table: it needs a genuine frontend component driven by budget_lines, not a
-- one-shot generated artifact.
--
-- Append-only, same pattern as evidence — a new write is a new row, never an
-- update in place. The application layer picks the latest row per
-- (project_id, engine, artifact_type) to display.

create table project_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  engine domain_type not null,
  artifact_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index project_artifacts_latest_idx
  on project_artifacts (project_id, engine, artifact_type, created_at desc);

alter table project_artifacts enable row level security;

create policy "members can read project_artifacts" on project_artifacts
  for select using (is_project_member(project_id));
create policy "members can write project_artifacts" on project_artifacts
  for insert with check (is_project_member(project_id));

alter publication supabase_realtime add table project_artifacts;
