import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallRoom } from "@/components/call/CallRoom";

// sendToYoxaAction (a Server Action invoked from this page) does a Gemini
// brief-generation call plus a real HTTP call to Yoxa, synchronously —
// comfortably past Vercel's default 10s function timeout. This raises the
// budget for every Server Action used within this route segment.
export const maxDuration = 60;

export default async function AgencyCallPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: activeSession } = await supabase
    .from("call_sessions")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, sender_role, text, turn_type, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: existingRun } = await supabase
    .from("workflow_runs")
    .select("workflow_run_id")
    .eq("project_id", projectId)
    .maybeSingle();

  return (
    <CallRoom
      projectId={projectId}
      selfId={user.id}
      currentRole={profile?.role === "admin" ? "admin" : "agency"}
      initialActiveCallSessionId={activeSession?.id ?? null}
      initialMessages={messages ?? []}
      alreadySentToYoxa={existingRun !== null}
    />
  );
}
