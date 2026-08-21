-- yoxa_hitl_requests and workflow_runs were created in 20260819000000, after
-- 20260818020000 established the "staff can read all <table>" pattern that
-- lets agency/admin users see every project without an explicit
-- project_members row (the real model: agency staff oversee all active
-- client projects, not just ones they were invited to). Those two tables
-- were never added to that grant, so an agency/admin user who isn't also a
-- project_member (the common case) could never see a pending HITL request
-- in their own Escalations page, even though the webhook had correctly
-- persisted it — confirmed live: a real approval_requested row existed in
-- the database but rendered as "Nothing open" for the agency test account.

create policy "staff can read all yoxa_hitl_requests" on yoxa_hitl_requests
  for select using (is_staff());
create policy "staff can update all yoxa_hitl_requests" on yoxa_hitl_requests
  for update using (is_staff());

create policy "staff can read all workflow_runs" on workflow_runs
  for select using (is_staff());
