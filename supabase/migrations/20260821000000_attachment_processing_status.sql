-- Attachments were previously stored raw with no processing pipeline at
-- all. This column tracks the async Gemini vision/document-understanding
-- pass that now runs after upload (see /api/projects/[projectId]/
-- attachments/[attachmentId]/process) — 'pending' until that pass writes
-- real evidence and flips it, 'failed' if the pass errored (surfaced in the
-- UI so a failed attachment doesn't sit silently unresolved forever).

alter table attachments
  add column status text not null default 'pending';
