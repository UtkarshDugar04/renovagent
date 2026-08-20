import type { SupabaseClient } from "@supabase/supabase-js";

// The real access model (see 20260818020000_agency_wide_access.sql): any
// agency/admin staff member can act on ANY project, not just ones they've
// been explicitly added to as a project_members row — deliberately, so a
// homeowner's self-onboarded project (see (homeowner)/actions.ts
// createProject, which only ever inserts the homeowner themselves) needs no
// separate invite flow for staff to reach it. A homeowner's access stays
// strictly scoped to their own project_members row. Routes that check
// project_members directly instead of this — the original pattern this
// replaces — silently lock staff out of exactly that common case.
export async function getProjectRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  userId: string
): Promise<"homeowner" | "agency" | "admin" | null> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "agency" || profile?.role === "admin") {
    return profile.role;
  }

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return membership?.role ?? null;
}
