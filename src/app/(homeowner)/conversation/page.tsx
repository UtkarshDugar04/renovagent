import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TalkTabs } from "@/components/conversation/TalkTabs";

export default async function ConversationPage() {
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

  const [{ data: messages }, { data: openQuestions }, { data: activeSession }] = await Promise.all([
    supabase
      .from("conversation_messages")
      .select("id, sender_role, text, turn_type, created_at")
      .eq("project_id", membership.project_id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("questions")
      .select("id, question_text, domain, severity")
      .eq("project_id", membership.project_id)
      .eq("status", "open")
      .order("severity", { ascending: false }),
    supabase
      .from("call_sessions")
      .select("id")
      .eq("project_id", membership.project_id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  return (
    <TalkTabs
      projectId={membership.project_id}
      selfId={user.id}
      messages={messages ?? []}
      openQuestions={openQuestions ?? []}
      activeCallSessionId={activeSession?.id ?? null}
    />
  );
}
