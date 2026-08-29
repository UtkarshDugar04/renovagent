"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain } from "@/lib/types/domain";

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

  await recomputeReadiness(supabase, projectId, (question?.domain ?? "family") as Domain);

  revalidatePath("/questions");
  revalidatePath("/understanding");
  revalidatePath("/design");
}
