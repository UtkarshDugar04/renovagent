-- Storage bucket for project attachments (photos, floor plans, reference
-- images, spec sheets). Private bucket — access is governed entirely by
-- the same project-membership / staff RLS model as everything else.
-- Path convention: {project_id}/{uuid}-{filename}, which is what lets the
-- policies below check membership without a second table lookup on every
-- object.

insert into storage.buckets (id, name, public)
values ('project-attachments', 'project-attachments', false)
on conflict (id) do nothing;

create policy "members can read their project's attachments"
  on storage.objects for select
  using (
    bucket_id = 'project-attachments'
    and (
      is_staff()
      or is_project_member((storage.foldername(name))[1]::uuid)
    )
  );

create policy "members can upload to their project's attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'project-attachments'
    and (
      is_staff()
      or is_project_member((storage.foldername(name))[1]::uuid)
    )
  );

create policy "members can delete their project's attachments"
  on storage.objects for delete
  using (
    bucket_id = 'project-attachments'
    and (
      is_staff()
      or is_project_member((storage.foldername(name))[1]::uuid)
    )
  );
