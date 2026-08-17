import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
        <h1 className="text-lg font-semibold text-stone-900">Activity</h1>
        <p className="text-sm text-stone-500">The story of your project so far.</p>
      </div>

      {(!events || events.length === 0) && (
        <p className="text-sm text-stone-400">Nothing to show yet.</p>
      )}

      <ol className="space-y-3 border-l border-stone-200 pl-4">
        {(events ?? []).map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-stone-300" />
            <p className="text-sm text-stone-700">{e.activity_summary}</p>
            <p className="text-xs text-stone-400">
              {new Date(e.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
