import { createClient } from "@/lib/supabase/server";
import { HandoffPanel } from "./handoff-panel";

export default async function HandoffPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("handoff_records")
    .select("id, brief, status, email_sent_to, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return <HandoffPanel projectId={projectId} records={records ?? []} />;
}
