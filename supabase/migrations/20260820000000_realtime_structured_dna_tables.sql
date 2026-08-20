-- The original realtime publication (20260818030000) covered evidence,
-- questions, conflicts, decisions, and readiness — but not the structured
-- tables the Yoxa MCP tools can now actually write to (project_constraints,
-- budget_lines, spatial_elements via updateCanonicalRenovationDna's newer
-- arrays; household_members likewise). Without this, a Constraint/Budget/
-- Spatial Intelligence Agent writing a real structured row never triggers a
-- live refresh — only its accompanying generic evidence write does, so the
-- DNA page's Constraints/Budget lines sections would silently go stale
-- until a manual reload.

alter publication supabase_realtime add table
  project_constraints,
  budget_lines,
  spatial_elements,
  household_members;
