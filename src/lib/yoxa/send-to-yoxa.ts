// The real "SEND TO YOXA" action — the single entry point into the whole
// Yoxa workflow (see the Yoxa workflow context doc's Entry Trigger
// section). One project gets exactly one of these: generate the brief,
// fire the real trigger, record the run. No retry-with-a-fresh-brief once
// the trigger call itself has succeeded — there is no second submission
// window.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateConversationBrief } from "@/lib/gemini/generate-brief";
import { triggerYoxaWorkflow } from "@/lib/yoxa/trigger";

export interface SendToYoxaResult {
  ok: boolean;
  error?: string;
  workflowRunId?: string | null;
}

export async function sendToYoxa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  senderRole: string
): Promise<SendToYoxaResult> {
  const { data: existingRun } = await supabase
    .from("workflow_runs")
    .select("workflow_run_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingRun) {
    return { ok: false, error: "This project has already been sent to Yoxa — there's no second submission." };
  }

  // Atomic claim: only succeeds if nobody else has claimed it. Guards two
  // agency users (or two tabs) clicking Send in the same window, which the
  // workflow_runs check above can't catch since neither request has a
  // workflow_run_id yet. Released on any failure below so a bad attempt
  // stays retryable — never released after a successful trigger, since
  // workflow_runs existing is the permanent record from then on.
  const { data: claimed } = await supabase
    .from("projects")
    .update({ yoxa_send_claimed_at: new Date().toISOString() })
    .eq("id", projectId)
    .is("yoxa_send_claimed_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, error: "Already being sent to Yoxa (possibly from another tab or teammate) — try again in a moment." };
  }

  async function releaseClaim() {
    await supabase.from("projects").update({ yoxa_send_claimed_at: null }).eq("id", projectId);
  }

  let brief: { markdown: string; messageCount: number };
  try {
    brief = await generateConversationBrief(supabase, projectId);
  } catch (err) {
    await releaseClaim();
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate the conversation brief" };
  }

  const result = await triggerYoxaWorkflow({
    projectId,
    senderRole,
    messageText: "Conversation brief attached — see file.",
    attachment: {
      filename: "conversation-brief.md",
      content: new Blob([brief.markdown], { type: "text/markdown" }),
    },
  });

  if (!result.ok) {
    await releaseClaim();
    return { ok: false, error: `Yoxa rejected the trigger (${result.statusCode}): ${result.rawBody}` };
  }
  if (!result.workflowRunId) {
    await releaseClaim();
    return { ok: false, error: "Yoxa accepted the trigger but returned no workflow_run_id — cannot track this run" };
  }

  const { error: insertError } = await supabase
    .from("workflow_runs")
    .insert({ workflow_run_id: result.workflowRunId, project_id: projectId });
  if (insertError) {
    // The Yoxa run is already live at this point — surfacing this as a
    // failure would be misleading. Log it; a stray unrecorded run just
    // means the HITL webhook can't resolve it back to this project later.
    console.error("sendToYoxa: workflow_runs insert failed after a successful trigger", insertError);
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "sent_to_yoxa",
    payload: { workflow_run_id: result.workflowRunId, message_count: brief.messageCount },
    activity_summary: "Sent to Yoxa — planning and design work has started.",
  });

  return { ok: true, workflowRunId: result.workflowRunId };
}
