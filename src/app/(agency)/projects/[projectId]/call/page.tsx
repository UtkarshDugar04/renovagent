import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallRoom } from "@/components/call/CallRoom";

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

  return (
    <CallRoom
      projectId={projectId}
      selfId={user.id}
      currentRole={profile?.role === "admin" ? "admin" : "agency"}
      initialActiveCallSessionId={activeSession?.id ?? null}
      initialMessages={messages ?? []}
    />
  );
}
