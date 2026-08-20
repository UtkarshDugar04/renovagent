-- attachments.status now flips pending -> processed/failed asynchronously
-- (see /api/projects/[projectId]/attachments/[attachmentId]/process). Without
-- realtime coverage, the understanding page's status badges would only ever
-- reflect whatever was true at the last page load.

alter publication supabase_realtime add table attachments;
