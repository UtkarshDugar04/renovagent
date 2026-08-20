"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendToYoxa } from "@/lib/yoxa/send-to-yoxa";
import { getProjectRole } from "@/lib/auth/project-access";

// Both participants call this on "join" — whoever gets there first creates
// the row, the second finds it via the unique partial index on
// (project_id) where status = 'active' and joins the same one.
export async function joinOrStartCallSession(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("call_sessions")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return { callSessionId: existing.id };

  const { data: created, error } = await supabase
    .from("call_sessions")
    .insert({ project_id: projectId, started_by: user.id })
    .select("id")
    .single();

  if (error || !created) {
    const { data: raceWinner } = await supabase
      .from("call_sessions")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "active")
      .maybeSingle();
    if (raceWinner) return { callSessionId: raceWinner.id };
    return { error: error?.message ?? "Couldn't start the call" };
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "call_started",
    activity_summary: "A live call started.",
  });

  return { callSessionId: created.id };
}

export async function endCallSession(callSessionId: string, projectId: string) {
  const supabase = await createClient();
  await supabase
    .from("call_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", callSessionId);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "call_ended",
    activity_summary: "The live call ended.",
  });
}

// The real "SEND TO YOXA" action. Agency-only (enforced by CallRoom not
// rendering the control for a homeowner, and re-checked here since a
// server action is a public endpoint regardless of what the UI shows) —
// via getProjectRole, so a staff member who was never explicitly added to
// this project (the normal case for a homeowner's self-onboarded project)
// isn't incorrectly locked out. workflow_runs has no member-insert RLS
// policy by design — it's meant to be written by trusted server code, not
// directly by any authenticated user — so the actual send runs on the
// service client once the role check passes on the session client.
export async function sendToYoxaAction(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return { ok: false, error: "Not a member of this project" };
  if (role === "homeowner") {
    return { ok: false, error: "Only the agency can send this project to Yoxa" };
  }

  const service = createServiceClient();
  return sendToYoxa(service, projectId, role);
}
