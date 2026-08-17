import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationPanel } from "@/components/conversation/ConversationPanel";

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

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("id, sender_role, text, created_at")
    .eq("project_id", membership.project_id)
    .order("created_at", { ascending: true });

  const { data: openQuestions } = await supabase
    .from("questions")
    .select("id, question_text, domain, severity")
    .eq("project_id", membership.project_id)
    .eq("status", "open")
    .order("severity", { ascending: false });

  return (
    <ConversationPanel
      projectId={membership.project_id}
      initialMessages={messages ?? []}
      openQuestions={openQuestions ?? []}
    />
  );
}
