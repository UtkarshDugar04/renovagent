-- Deployed HITL support for the Yoxa workflow. Two tables:
--
-- workflow_runs: created when we successfully trigger a Yoxa run, so an
-- inbound HITL webhook (keyed by workflow_run_id, no project_id of its
-- own) can be routed back to the right project.
--
-- yoxa_hitl_requests: one row per Yoxa human_approval request. Yoxa owns
-- request_id (needed only for the response call); the stable local join
-- key is workflow_run_id, per Yoxa's own integration contract. event_id
-- is unique to make webhook delivery safely idempotent — Yoxa's delivery
-- is at-least-once.

create table workflow_runs (
  workflow_run_id text primary key,
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table yoxa_hitl_requests (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  workflow_run_id text not null references workflow_runs(workflow_run_id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  yoxa_request_id text not null,
  title text not null,
  description text,
  options jsonb not null default '[]',
  status text not null default 'pending',
  selected_option_id text,
  override_message text,
  answered_by uuid references profiles(id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index yoxa_hitl_requests_project_idx on yoxa_hitl_requests (project_id, status);

alter table workflow_runs enable row level security;
alter table yoxa_hitl_requests enable row level security;

create policy "members can read workflow_runs" on workflow_runs
  for select using (is_project_member(project_id));
create policy "members can read yoxa_hitl_requests" on yoxa_hitl_requests
  for select using (is_project_member(project_id));

alter publication supabase_realtime add table yoxa_hitl_requests;
