import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";

const NAV = [
  { segment: "overview", label: "Overview" },
  { segment: "dna", label: "Renovation DNA" },
  { segment: "design-review", label: "Design Review" },
  { segment: "escalations", label: "Escalations" },
  { segment: "handoff", label: "Handoff" },
] as const;

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
        <Link href="/projects" className="text-xs text-stone-400 hover:text-stone-700">
          ← All projects
        </Link>
        <h1 className="text-lg font-semibold text-stone-900">{project.name}</h1>
      </div>
      <nav className="mb-6 flex gap-1 border-b border-stone-200">
        {NAV.map((item) => (
          <Link
            key={item.segment}
            href={`/projects/${projectId}/${item.segment}`}
            className="px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
