import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallRoom } from "@/components/call/CallRoom";

export default async function CallPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/");

  const { data: activeSession } = await supabase
    .from("call_sessions")
    .select("id")
    .eq("project_id", membership.project_id)
    .eq("status", "active")
    .maybeSingle();

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, sender_role, text, turn_type, created_at")
    .eq("project_id", membership.project_id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Call</h1>
        <p className="text-sm text-muted-foreground">
          Talk it through live with your agency — Renovagent listens in and asks along the way.
        </p>
      </div>
      <CallRoom
        projectId={membership.project_id}
        selfId={user.id}
        currentRole="homeowner"
        initialActiveCallSessionId={activeSession?.id ?? null}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
