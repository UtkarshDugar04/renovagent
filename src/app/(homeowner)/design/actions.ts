"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processTurn } from "@/lib/yoxa/process-turn";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import { applyDesignOptionFeedback } from "@/lib/dna/design-option-feedback";
import type { Domain } from "@/lib/types/domain";

// Design feedback is a first-class turn, not a database write in isolation
// — it goes through the same Knowledge Update Protocol as a conversation
// message, because "I like the layout but hate the colour" needs to become
// two distinct, correctly-scoped pieces of evidence, not one blob.
export async function submitDesignFeedback(
  designOptionId: string,
  projectId: string,
  sentiment: "like" | "dislike" | "neutral",
  comment: string,
  subElement?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: option } = await supabase
    .from("design_options")
    .select("label")
    .eq("id", designOptionId)
    .single();

  await applyDesignOptionFeedback(supabase, {
    designOptionId,
    projectId,
    sentiment,
    comment: comment || null,
    subElement: subElement ?? null,
    createdBy: user.id,
  });

  const feedbackMessage = subElement
    ? `About "${option?.label}", the ${subElement}: ${sentiment} — ${comment}`
    : `About "${option?.label}": ${sentiment}${comment ? ` — ${comment}` : ""}`;

  const { data: message } = await supabase
    .from("conversation_messages")
    .insert({
      project_id: projectId,
      sender_role: "homeowner",
      sender_id: user.id,
      text: feedbackMessage,
      turn_type: "design_feedback",
    })
    .select()
    .single();

  const turnResult = await processTurn({
    projectId,
    turnType: "design_feedback",
    message: feedbackMessage,
    senderRole: "homeowner",
    attachments: [],
    context: { recentConversation: [], openQuestions: [], domainReadiness: {}, knownEvidence: [] },
  });

  if (turnResult.extractedEvidence.length > 0) {
    await supabase.from("evidence").insert(
      turnResult.extractedEvidence.map((e) => ({
        project_id: projectId,
        domain: e.domain,
        evidence_type: e.evidenceType,
        statement: e.statement,
        status: "explicit",
        confidence: e.confidence,
        authority: "d0_agent",
        source: `design_feedback:${message?.id}`,
      }))
    );

    const touchedDomains = new Set(turnResult.extractedEvidence.map((e) => e.domain));
    for (const domain of touchedDomains) {
      await recomputeReadiness(supabase, projectId, domain as Domain);
    }
  }

  revalidatePath("/design");
  revalidatePath("/activity");
  revalidatePath("/understanding");
}
