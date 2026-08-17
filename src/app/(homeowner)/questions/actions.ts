"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function confirmMeaning(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase.from("decisions").insert({
    project_id: projectId,
    decision_text: "meaning_verification_confirmed",
    decision_maker_role: "homeowner",
    rationale: "Homeowner confirmed the system's understanding is accurate.",
  });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "meaning_verified",
    activity_summary: "You confirmed Renovagent's understanding of your project is accurate.",
  });

  revalidatePath("/questions");
  revalidatePath("/design");
}

export async function answerQuestion(questionId: string, projectId: string, answerText: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: question } = await supabase
    .from("questions")
    .select("question_text, domain")
    .eq("id", questionId)
    .single();

  await supabase.from("evidence").insert({
    project_id: projectId,
    domain: question?.domain ?? "family",
    evidence_type: "requirement",
    statement: answerText,
    status: "explicit",
    confidence: "high",
    authority: "d2_homeowner",
    source: `question_answer:${questionId}`,
  });

  await supabase
    .from("questions")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", questionId);

  revalidatePath("/questions");
  revalidatePath("/understanding");
}

export async function resolveApproval(
  approvalId: string,
  status: "approved" | "rejected"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase
    .from("approval_requests")
    .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", approvalId);

  revalidatePath("/questions");
  revalidatePath("/design");
}
