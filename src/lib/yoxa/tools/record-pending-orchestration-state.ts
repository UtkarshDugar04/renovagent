import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import { ToolError } from "./errors";

export interface PendingActionInput {
  description: string;
  owner?: string;
  dueContext?: string;
}

export interface RecordPendingOrchestrationStateInput {
  summary: string;
  pendingActions?: PendingActionInput[];
  escalationLevel?: string;
}

// Shared logic behind recordPendingOrchestrationState — the Planning &
// Orchestration Agent's reconciliation log. There's no dedicated table for
// "pending next actions"; it's stored as a structured events row, same
// realtime-enabled table since day one, so this already reflects live on
// the dashboard with no extra plumbing. See get-canonical-renovation-dna.ts
// for why this lives separately from the route handlers that call it.
export async function recordPendingOrchestrationState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordPendingOrchestrationStateInput
) {
  if (!input.summary) {
    throw new ToolError(400, "summary is required");
  }

  const pendingActions = input.pendingActions ?? [];

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      project_id: projectId,
      event_type: "orchestration_state",
      payload: { pendingActions, escalationLevel: input.escalationLevel ?? null, source: "yoxa" } as unknown as Json,
      activity_summary: input.summary,
    })
    .select()
    .single();

  if (error) throw new ToolError(500, error.message);

  return { event };
}
