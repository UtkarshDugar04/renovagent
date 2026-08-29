-- The HITL respond route (src/app/api/projects/[projectId]/hitl/[hitlRequestId]/respond/route.ts)
-- used to derive which Yoxa deployment to answer against purely from the
-- current YOXA_TRIGGER_URL env var — fine as long as exactly one deployment
-- ever existed, but wrong the moment a project's run was triggered under an
-- older deployment and the env var later moves on to a newer one: the
-- response gets sent to a deployment that never issued that HITL request,
-- and Yoxa correctly rejects it (confirmed live: 403
-- public_workflow_deployment_hitl_response_rejected).
--
-- Recording the deployment a run actually started under, at trigger time,
-- makes responding to it correct regardless of which deployment is
-- currently live. Every existing row was triggered under the one and only
-- deployment that existed before today's release switch, so it's safe to
-- backfill them all with that known id.

alter table workflow_runs
  add column deployment_id text;

update workflow_runs
  set deployment_id = 'f319da54-287c-4304-b7b7-a686877c06e6'
  where deployment_id is null;
