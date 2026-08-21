"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Live count of pending yoxa_hitl_requests for a project, plus a toast on
// each new one — the notification layer that was missing entirely: a
// pending decision previously only became visible if someone happened to
// navigate into Escalations (agency) or Questions & Decisions (homeowner)
// on their own. `reviewHref` decides where the toast's action button and
// badge link to, since agency and homeowner use different pages for this.
export function usePendingHitlCount(projectId: string | undefined, reviewHref: string) {
  const [count, setCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // No reset-to-0 here when projectId is absent: both callers only ever
    // render the badge while a project is in scope (agency's project nav
    // block and the homeowner shell are both conditional on having one),
    // so there's no case where a stale nonzero count could show.
    if (!projectId) return;

    const supabase = createClient();
    const pid = projectId;
    let active = true;

    async function loadCount() {
      const { count: initial } = await supabase
        .from("yoxa_hitl_requests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", pid)
        .eq("status", "pending");
      if (active) setCount(initial ?? 0);
    }
    loadCount();

    const channel = supabase
      .channel(`hitl-notify:${pid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "yoxa_hitl_requests", filter: `project_id=eq.${pid}` },
        (payload) => {
          setCount((c) => c + 1);
          const title = (payload.new as { title?: string }).title ?? "A new decision is waiting";
          toast("Renovagent needs a decision", {
            description: title,
            action: { label: "Review", onClick: () => router.push(reviewHref) },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "yoxa_hitl_requests", filter: `project_id=eq.${pid}` },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          const oldStatus = (payload.old as { status?: string }).status;
          if (oldStatus === "pending" && newStatus !== "pending") {
            setCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId, reviewHref, router]);

  return count;
}
