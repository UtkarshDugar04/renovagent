import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";

export interface PreferenceImageReactionInput {
  preferenceImageId: string;
  projectId: string;
  reaction: "thumbs_up" | "thumbs_down" | "save";
  imageCaption?: string | null;
  createdBy?: string | null;
}

// Shared logic behind the homeowner/agency thumbs-up/down/save click on a
// moodboard image. thumbs_up/thumbs_down are a stated preference — they
// write an evidence row and recompute preference readiness, same as
// applyDesignOptionFeedback does for design options. save is a pure
// bookmark: no evidence, no readiness recompute, since "saved for later"
// isn't itself a stated preference the way an explicit up/down is.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyPreferenceImageReaction(supabase: SupabaseClient<any>, input: PreferenceImageReactionInput) {
  await supabase.from("preference_image_reactions").insert({
    preference_image_id: input.preferenceImageId,
    reaction: input.reaction,
    created_by: input.createdBy ?? null,
  });

  if (input.reaction === "thumbs_up" || input.reaction === "thumbs_down") {
    await supabase.from("evidence").insert({
      project_id: input.projectId,
      domain: "preference",
      evidence_type: "preference",
      statement: `Homeowner ${input.reaction === "thumbs_up" ? "liked" : "disliked"} a moodboard image${input.imageCaption ? `: ${input.imageCaption}` : ""}`,
      status: "explicit",
      confidence: "high",
      authority: "d2_homeowner",
      source: "homeowner:preference_image_reaction",
    });
    await recomputeReadiness(supabase, input.projectId, "preference");
  }

  await supabase.from("events").insert({
    project_id: input.projectId,
    event_type: "preference_image_reaction",
    activity_summary: `A moodboard image was reacted to (${input.reaction}).`,
  });
}
