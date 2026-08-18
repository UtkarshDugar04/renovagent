import type { SupabaseClient } from "@supabase/supabase-js";

export interface DesignOptionFeedbackInput {
  designOptionId: string;
  projectId: string;
  sentiment: "like" | "dislike" | "neutral";
  comment?: string | null;
  subElement?: string | null;
  createdBy?: string | null;
}

// Shared by the homeowner-facing server action (raw text feedback, our
// own stub interprets it) and the Yoxa-facing experience-feedback route
// (feedback already classified by the Experience and Decision Facilitator
// agent) — both need the same underlying write: record the feedback row,
// reject the option on a dislike, log the activity event.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyDesignOptionFeedback(supabase: SupabaseClient<any>, input: DesignOptionFeedbackInput) {
  await supabase.from("design_option_feedback").insert({
    design_option_id: input.designOptionId,
    sub_element: input.subElement ?? null,
    sentiment: input.sentiment,
    comment: input.comment ?? null,
    created_by: input.createdBy ?? null,
  });

  if (input.sentiment === "dislike") {
    await supabase
      .from("design_options")
      .update({ status: "rejected" })
      .eq("id", input.designOptionId)
      .eq("status", "proposed");
  }

  await supabase.from("events").insert({
    project_id: input.projectId,
    event_type: "feedback_recorded",
    activity_summary: `Feedback recorded on a design option: ${input.sentiment}${input.comment ? ` — ${input.comment}` : ""}`,
  });
}
