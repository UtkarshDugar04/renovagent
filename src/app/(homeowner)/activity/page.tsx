import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function ActivityPage() {
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

  const { data: events } = await supabase
    .from("events")
    .select("id, activity_summary, event_type, created_at")
    .eq("project_id", membership.project_id)
    .not("activity_summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">The story of your project so far.</p>
      </div>

      {(!events || events.length === 0) && (
        <EmptyState icon={History} description="Nothing to show yet." />
      )}

      <ol className="space-y-3 border-l border-border pl-4">
        {(events ?? []).map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="text-sm text-foreground/90">{e.activity_summary}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
