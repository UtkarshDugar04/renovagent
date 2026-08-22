-- project_artifacts predates the is_staff() grant pattern established in
-- 20260818020000_agency_wide_access.sql (that migration's fixed table list
-- was written before project_artifacts existed) and never got it — the
-- same bug class already found and fixed today for yoxa_hitl_requests and
-- workflow_runs. Closing it here, and granting the same access to the new
-- tables from this feature at creation time rather than waiting to
-- discover the gap again later.

create policy "staff can read all project_artifacts" on project_artifacts
  for select using (is_staff());
create policy "staff can write all project_artifacts" on project_artifacts
  for insert with check (is_staff());

create policy "staff can read all preference_images" on preference_images
  for select using (is_staff());
create policy "staff can write all preference_images" on preference_images
  for insert with check (is_staff());

create policy "staff can read all preference_image_reactions" on preference_image_reactions
  for select using (is_staff());
create policy "staff can write all preference_image_reactions" on preference_image_reactions
  for insert with check (is_staff());

create policy "staff can read all design_option_images" on design_option_images
  for select using (is_staff());
create policy "staff can write all design_option_images" on design_option_images
  for insert with check (is_staff());
