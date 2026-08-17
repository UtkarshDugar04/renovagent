-- Agency/admin staff can see and act across every project, not just ones
-- they've been explicitly added to as a project_member — this matches the
-- real model (an agency team oversees all its active client projects)
-- without requiring a per-project invite flow for the MVP. Homeowner access
-- remains strictly project_members-scoped; this only widens staff access.

create or replace function is_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('agency', 'admin')
  );
$$;

create policy "staff can read all projects" on projects
  for select using (is_staff());
create policy "staff can update all projects" on projects
  for update using (is_staff());

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
      'create policy "staff can read all %1$s" on %1$s for select using (is_staff());',
      t
    );
    execute format(
      'create policy "staff can write all %1$s" on %1$s for insert with check (is_staff());',
      t
    );
    execute format(
      'create policy "staff can update all %1$s" on %1$s for update using (is_staff());',
      t
    );
  end loop;
end $$;

create policy "staff can read all design_option_feedback" on design_option_feedback
  for select using (is_staff());

create policy "staff can read all project_members" on project_members
  for select using (is_staff());
create policy "staff can add project_members" on project_members
  for insert with check (is_staff());
