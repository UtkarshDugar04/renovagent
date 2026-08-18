-- Live call support: agency and homeowner join a real-time audio/video call;
-- each side's browser transcribes its own mic locally (Web Speech API) and
-- posts finalized segments into conversation_messages (turn_type
-- 'call_transcript'), which flows through the exact same Knowledge Update
-- Protocol as typed chat. WebRTC signaling itself (SDP/ICE) happens over a
-- Supabase Realtime broadcast channel, not through the database — no table
-- needed for that part.

create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null default 'active',
  started_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table call_sessions enable row level security;

create policy "members can read call_sessions" on call_sessions
  for select using (is_project_member(project_id));
create policy "members can write call_sessions" on call_sessions
  for insert with check (is_project_member(project_id));
create policy "members can update call_sessions" on call_sessions
  for update using (is_project_member(project_id));

alter table conversation_messages
  add column call_session_id uuid references call_sessions(id);

alter publication supabase_realtime add table call_sessions;
