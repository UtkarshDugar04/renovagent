-- recompute-readiness.ts is a crude, evidence-count-based stand-in
-- ("propose"/"validate" heuristic) that runs on every evidence write —
-- including from the live-call path — and always overwrites the
-- `readiness` row for whatever domain was touched. Once Yoxa's real
-- Validation Agent commits an independent assessment via
-- recordReadinessAssessment (or the Impact & Change Propagation Agent
-- updates it via applyDependencyImpactPatch), nothing distinguished that
-- real, authoritative write from the heuristic's next automatic guess —
-- the heuristic would silently clobber it on the very next unrelated
-- evidence write, with no trace.
--
-- `source` marks provenance so the heuristic can tell the difference and
-- back off permanently once a domain has a real assessment on file — see
-- the corresponding change in recompute-readiness.ts.

alter table readiness
  add column source text not null default 'heuristic';
