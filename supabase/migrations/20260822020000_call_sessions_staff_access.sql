-- call_sessions was created in 20260818060000, after 20260818020000
-- established the "staff can access all <table>" pattern — same bug class
-- already fixed twice this session for yoxa_hitl_requests/workflow_runs
-- and for project_artifacts + the new engine-visuals tables. Left out
-- here too: an agency/admin user (who normally has no project_members row
-- — see src/lib/auth/project-access.ts) could never see or join a live
-- call, or even see that the homeowner's session existed via realtime.
-- Confirmed live: agency "start call" silently failed (RLS rejected the
-- insert, the error was swallowed client-side) and the homeowner was
-- stuck on "Setting up your camera & mic…" forever, since no second
-- participant could ever join to advance the WebRTC handshake.

create policy "staff can read all call_sessions" on call_sessions
  for select using (is_staff());
create policy "staff can write all call_sessions" on call_sessions
  for insert with check (is_staff());
create policy "staff can update all call_sessions" on call_sessions
  for update using (is_staff());
