-- Prevent two concurrent "active" call_sessions rows for the same project
-- (e.g. agency and homeowner both clicking "start call" in the same
-- instant) so both sides always land in the same session.
create unique index call_sessions_one_active_per_project
  on call_sessions (project_id)
  where status = 'active';
