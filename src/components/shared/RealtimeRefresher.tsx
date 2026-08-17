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
