-- Guards the real "SEND TO YOXA" action against two failure modes the
-- workflow_runs-only check couldn't cover: two agency users (or two tabs)
-- clicking Send within the same window before either has a workflow_run_id
-- back, and a request that dies mid-flight (Gemini brief generation is not
-- instant) leaving no clean signal either way.
--
-- send-to-yoxa.ts claims this atomically (UPDATE ... WHERE
-- yoxa_send_claimed_at IS NULL) before doing any real work, and releases it
-- on any failure short of a successful Yoxa trigger — so a failed attempt
-- stays retryable, but two concurrent attempts can't both proceed.

alter table projects
  add column yoxa_send_claimed_at timestamptz;
