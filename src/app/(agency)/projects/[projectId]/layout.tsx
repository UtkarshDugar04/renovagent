import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { ProjectSubNav } from "./project-sub-nav";

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
      <div className="mb-4">
        <Link
          href="/projects"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          All projects
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
      </div>
      <ProjectSubNav projectId={projectId} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
