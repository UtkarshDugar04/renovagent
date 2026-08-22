"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROJECT_SCOPED_TABLES = [
  "conversation_messages",
  "evidence",
  "questions",
  "conflicts",
  "decisions",
  "readiness",
  "design_options",
  "validation_results",
  "escalations",
  "approval_requests",
  "events",
  "handoff_records",
  "yoxa_hitl_requests",
  "project_constraints",
  "budget_lines",
  "spatial_elements",
  "household_members",
  "project_artifacts",
  "preference_images",
  // preference_image_reactions and design_option_images are keyed off their
  // parent row (preference_image_id / design_option_id), not project_id —
  // same reason design_option_feedback was never added here either. A
  // reaction/image being added on an existing image/option won't trigger a
  // live refresh through this mechanism; a full page reload still shows it.
] as const;

// Renders nothing. Subscribes to every table a live project view depends
// on, scoped to this project, and re-fetches server data on any change —
// the simplest correct pattern for Server Components: let Postgres changes
// trigger a refresh rather than reconciling realtime payloads client-side.
export function RealtimeRefresher({ projectId }: { projectId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`project:${projectId}`);

    for (const table of PROJECT_SCOPED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `project_id=eq.${projectId}` },
        () => router.refresh()
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  return null;
}
