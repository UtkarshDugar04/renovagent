-- RENOVAGENT initial schema
-- Renovation DNA lives here, canonically. YOXA never stores it; every agent execution
-- receives a scoped read and returns structured proposals the application writes.

create extension if not exists "pgcrypto";

-- ---------- enums ----------

create type user_role as enum ('homeowner', 'agency', 'admin');
create type domain_type as enum ('family', 'spatial', 'preference', 'budget', 'constraint');
create type evidence_type as enum (
  'aspiration','requirement','preference','routine','pain_point','observation',
  'constraint','priority','decision','trade_off','assumption','inference',
  'question','conflict','verification','rejection'
);
create type evidence_status as enum (
  'explicit','verified','inferred','assumed','unresolved','conflicted','stale','superseded'
);
create type confidence_level as enum ('unknown','low','medium','high');
create type authority_level as enum ('d0_agent','d1_recommendation','d2_homeowner','d3_professional','d4_external');
create type severity_level as enum ('e0','e1','e2','e3','e4','e5');
create type question_status as enum ('open','waiting','resolved');
create type constraint_hardness as enum ('hard','soft','negotiable');
create type constraint_status as enum ('confirmed','provisional','unresolved','requires_verification','cleared');
create type design_option_status as enum ('proposed','validated','rejected');
create type sourcing_status as enum ('not_evaluated','grounded','indicative','ungrounded');
create type escalation_status as enum ('open','waiting','resolved');
create type readiness_state as enum ('not_started','discovery_in_progress','partially_understood','sufficient_for_validation','validated');

-- ---------- core identity ----------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'homeowner',
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  property_address text,
  scope_summary text,
  budget_comfortable_low numeric,
  budget_comfortable_high numeric,
  budget_stretch_low numeric,
  budget_stretch_high numeric,
  budget_ceiling numeric,
  phase text not null default 'discovery',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  role_in_household text,
  is_primary_contact boolean not null default false,
  accessibility_needs text,
  created_at timestamptz not null default now()
);

-- ---------- evidence, the atomic unit ----------

create table evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  domain domain_type not null,
  evidence_type evidence_type not null,
  statement text not null,
  status evidence_status not null default 'explicit',
  confidence confidence_level not null default 'unknown',
  authority authority_level not null default 'd0_agent',
  source text,
  household_member_id uuid references household_members(id),
  contradicts_evidence_id uuid references evidence(id),
  superseded_by_id uuid references evidence(id),
  related_evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index evidence_project_domain_idx on evidence (project_id, domain);
create index evidence_status_idx on evidence (project_id, status);

-- ---------- spatial / budget / constraint structured detail ----------

create table spatial_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  room text,
  element_type text not null,
  attributes jsonb not null default '{}',
  certainty text not null default 'unknown',
  requires_verification boolean not null default false,
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category text not null,
  probable_low numeric,
  probable_high numeric,
  estimated numeric,
  quoted numeric,
  confirmed numeric,
  priority_tier text not null default 'should_fund',
  created_at timestamptz not null default now()
);

create table project_constraints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category text not null,
  hardness constraint_hardness not null default 'soft',
  status constraint_status not null default 'unresolved',
  description text not null,
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- questions, assumptions, decisions, trade-offs, conflicts ----------

create table questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  domain domain_type,
  question_text text not null,
  why_it_matters text,
  severity severity_level not null default 'e1',
  blocks_readiness boolean not null default false,
  owner_role user_role,
  status question_status not null default 'open',
  resolution_evidence_id uuid references evidence(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table assumptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  statement text not null,
  domain domain_type,
  confidence confidence_level not null default 'low',
  impact_if_wrong text,
  verification_required boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  decision_text text not null,
  decision_maker_role user_role,
  alternatives_considered text[] not null default '{}',
  rationale text,
  affected_domains domain_type[] not null default '{}',
  reversibility text,
  status text not null default 'active',
  supersedes_decision_id uuid references decisions(id),
  created_at timestamptz not null default now()
);

create table trade_offs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  gained text not null,
  sacrificed text not null,
  reason text,
  accepted_by_role user_role,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table conflicts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  evidence_a_id uuid not null references evidence(id),
  evidence_b_id uuid not null references evidence(id),
  reason text not null,
  affected_domains domain_type[] not null default '{}',
  blocks_decision_id uuid references decisions(id),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- readiness ----------

create table readiness (
  project_id uuid not null references projects(id) on delete cascade,
  domain domain_type not null,
  state readiness_state not null default 'not_started',
  reason text,
  updated_at timestamptz not null default now(),
  primary key (project_id, domain)
);

-- ---------- design, sourcing, validation ----------

create table design_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_number int not null,
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table design_options (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  design_round_id uuid not null references design_rounds(id) on delete cascade,
  label text not null,
  rationale text not null,
  satisfies_evidence_ids uuid[] not null default '{}',
  trade_offs jsonb not null default '[]',
  cost_band jsonb,
  sourcing_status sourcing_status not null default 'not_evaluated',
  what_it_would_feel_like text,
  status design_option_status not null default 'proposed',
  visible_to_homeowner boolean not null default false,
  created_at timestamptz not null default now()
);

create table design_option_feedback (
  id uuid primary key default gen_random_uuid(),
  design_option_id uuid not null references design_options(id) on delete cascade,
  sub_element text,
  sentiment text not null,
  comment text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table validation_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  mode text not null,
  target_type text not null,
  target_id uuid,
  result text not null,
  failed_criteria jsonb not null default '[]',
  unresolved_risks jsonb not null default '[]',
  human_decision_required boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- escalations, approvals ----------

create table escalations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  trigger text not null,
  question text,
  domain domain_type,
  severity severity_level not null default 'e3',
  required_authority authority_level not null default 'd3_professional',
  blocking boolean not null default true,
  status escalation_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  design_option_id uuid references design_options(id),
  decision_id uuid references decisions(id),
  question text not null,
  status text not null default 'pending',
  resolved_by uuid references profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- conversation, events, handoff ----------

create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sender_role user_role not null,
  sender_id uuid references profiles(id),
  text text not null,
  turn_type text not null default 'new_message',
  extracted_evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  activity_summary text,
  created_at timestamptz not null default now()
);

create index events_project_created_idx on events (project_id, created_at desc);

create table handoff_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  brief text not null,
  email_content text,
  email_sent_to text,
  approved_by uuid references profiles(id),
  status text not null default 'pending_approval',
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  label text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------

alter table projects enable row level security;
alter table project_members enable row level security;
alter table household_members enable row level security;
alter table evidence enable row level security;
alter table spatial_elements enable row level security;
alter table budget_lines enable row level security;
alter table project_constraints enable row level security;
alter table questions enable row level security;
alter table assumptions enable row level security;
alter table decisions enable row level security;
alter table trade_offs enable row level security;
alter table conflicts enable row level security;
alter table readiness enable row level security;
alter table design_rounds enable row level security;
alter table design_options enable row level security;
alter table design_option_feedback enable row level security;
alter table validation_results enable row level security;
alter table escalations enable row level security;
alter table approval_requests enable row level security;
alter table conversation_messages enable row level security;
alter table events enable row level security;
alter table handoff_records enable row level security;
alter table attachments enable row level security;

create or replace function is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- projects + membership
create policy "members can read their projects" on projects
  for select using (is_project_member(id));
create policy "members can update their projects" on projects
  for update using (is_project_member(id));
create policy "authenticated users can create projects" on projects
  for insert with check (auth.uid() is not null);

create policy "members can read project_members rows for their projects" on project_members
  for select using (is_project_member(project_id));

-- generic per-table policy: any project member can read/write project-scoped rows.
-- homeowner-vs-agency visibility differences are enforced in the application layer,
-- not in RLS, since both roles are legitimate project members with different UI lenses.
do $$
declare
  t text;
begin
  foreach t in array array[
    'household_members','evidence','spatial_elements','budget_lines','project_constraints',
    'questions','assumptions','decisions','trade_offs','conflicts','readiness',
    'design_rounds','design_options','validation_results','escalations',
    'approval_requests','conversation_messages','events','handoff_records','attachments'
  ]
  loop
    execute format(
      'create policy "members can read %1$s" on %1$s for select using (is_project_member(project_id));',
      t
    );
    execute format(
      'create policy "members can write %1$s" on %1$s for insert with check (is_project_member(project_id));',
      t
    );
    execute format(
      'create policy "members can update %1$s" on %1$s for update using (is_project_member(project_id));',
      t
    );
  end loop;
end $$;

-- design_option_feedback is keyed off design_option_id, not project_id directly
create policy "members can read design_option_feedback" on design_option_feedback
  for select using (
    exists (select 1 from design_options d where d.id = design_option_id and is_project_member(d.project_id))
  );
create policy "members can write design_option_feedback" on design_option_feedback
  for insert with check (
    exists (select 1 from design_options d where d.id = design_option_id and is_project_member(d.project_id))
  );

-- profiles: users can read/update their own row
alter table profiles enable row level security;
create policy "users can read own profile" on profiles for select using (id = auth.uid());
create policy "users can update own profile" on profiles for update using (id = auth.uid());
create policy "users can insert own profile" on profiles for insert with check (id = auth.uid());
