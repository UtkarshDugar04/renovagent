-- Homeowners had no way to insert their own project_members row at all —
-- the only insert policy on this table was staff-only. Add a narrowly
-- scoped self-insert policy: a user may only add themselves, and only as
-- 'homeowner', so this can never be used to self-promote to agency/admin
-- (staff-wide access still requires the existing staff-only insert policy
-- or a direct database action).

create policy "users can add themselves as homeowner members" on project_members
  for insert with check (user_id = auth.uid() and role = 'homeowner');
