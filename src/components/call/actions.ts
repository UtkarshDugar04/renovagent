"use server";

import { createClient } from "@/lib/supabase/server";

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
