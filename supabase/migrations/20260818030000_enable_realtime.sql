-- Enable Realtime broadcast for every project-scoped table a live UI needs
-- to react to. RLS still applies to Realtime payloads, so a subscriber only
-- receives changes for rows they're actually allowed to read.

alter publication supabase_realtime add table
  conversation_messages,
  evidence,
  questions,
  conflicts,
  decisions,
  readiness,
  design_options,
  validation_results,
  escalations,
  approval_requests,
  events,
  handoff_records;
