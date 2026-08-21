import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";

// Project-scoped navigation (Overview/Call/DNA/Design Review/Escalations/
// Handoff) lives in the sidebar now — see AgencyShell, which reads the
// projectId out of the pathname — so this layout only needs the project
// name heading and the realtime subscription.
export default async function ProjectLayout({
  children,
  params,
}: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  return (
    <div>
      <RealtimeRefresher projectId={projectId} />
      <h1 className="mb-6 text-lg font-semibold tracking-tight">{project.name}</h1>
      {children}
    </div>
  );
}
