import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processTurn } from "@/lib/yoxa/process-turn";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import { getProjectRole } from "@/lib/auth/project-access";
import type { Domain } from "@/lib/types/domain";

// POST /api/projects/:projectId/messages
// Implements the Knowledge Update Protocol: validate → write the inbound
// message → call the YOXA boundary → write whatever it proposes as
// canonical state → log an event → return the product-level result the
// frontend renders. No agent output is ever trusted directly — this route
// is the only writer.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) {
    return NextResponse.json({ error: "Not a member of this project" }, { status: 403 });
  }

  const body = await request.json();
  const text = String(body?.text ?? "").trim();
  const attachmentIds: string[] = Array.isArray(body?.attachmentIds) ? body.attachmentIds : [];
  const turnType: string = typeof body?.turnType === "string" ? body.turnType : "new_message";
  const callSessionId: string | null = typeof body?.callSessionId === "string" ? body.callSessionId : null;

  if (!text && attachmentIds.length === 0) {
    return NextResponse.json({ error: "Message text or an attachment is required" }, { status: 400 });
  }

  // 1. Persist the inbound message (non-canonical log, but the context source).
  const { data: message, error: messageError } = await supabase
    .from("conversation_messages")
    .insert({
      project_id: projectId,
      sender_role: role,
      sender_id: user.id,
      text,
      turn_type: turnType,
      call_session_id: callSessionId,
    })
    .select()
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: messageError?.message ?? "Failed to save message" }, { status: 500 });
  }

  // 2. Assemble scoped context.
  const { data: recentMessages } = await supabase
    .from("conversation_messages")
    .select("sender_role, text")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: openQuestions } = await supabase
    .from("questions")
    .select("id, question_text, domain, severity")
    .eq("project_id", projectId)
    .eq("status", "open");

  const { data: readinessRows } = await supabase
    .from("readiness")
    .select("domain, state")
    .eq("project_id", projectId);

  const { data: attachmentRows } = attachmentIds.length > 0
    ? await supabase
        .from("attachments")
        .select("id, label, mime_type")
        .in("id", attachmentIds)
        .eq("project_id", projectId)
    : { data: [] };

  // 3. Call the YOXA boundary (stubbed today).
  const turnResult = await processTurn({
    projectId,
    turnType: turnType as "new_message" | "design_feedback" | "decision_resolution" | "call_transcript",
    message: text,
    attachments: (attachmentRows ?? []).map((a) => ({
      id: a.id,
      label: a.label ?? "attachment",
      mimeType: a.mime_type,
    })),
    context: {
      recentConversation: (recentMessages ?? [])
        .reverse()
        .map((m) => ({ role: m.sender_role, text: m.text })),
      openQuestions: (openQuestions ?? []).map((q) => ({
        id: q.id,
        text: q.question_text,
        domain: q.domain ?? "",
        severity: q.severity,
      })),
      domainReadiness: Object.fromEntries((readinessRows ?? []).map((r) => [r.domain, r.state])),
    },
  });

  // 4. Knowledge Update Protocol — write whatever the turn proposed.
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
        source: `conversation:${message.id}`,
      }))
    );

    await supabase
      .from("conversation_messages")
      .update({ extracted_evidence_ids: [] })
      .eq("id", message.id);

    const touchedDomains = new Set(turnResult.extractedEvidence.map((e) => e.domain));
    for (const domain of touchedDomains) {
      await recomputeReadiness(supabase, projectId, domain as Domain);
    }
  }

  if (turnResult.gaps.length > 0) {
    await supabase.from("questions").insert(
      turnResult.gaps.map((g) => ({
        project_id: projectId,
        domain: g.domain,
        question_text: g.question,
        why_it_matters: g.whyItMatters,
        severity: g.severity,
      }))
    );
  }

  // 5. Log the reply as a message + an activity event. Call-transcript turns
  // often produce no reply (see the stub) — skip writing an empty bubble.
  const { data: replyMessage } = turnResult.conversationalReply
    ? await supabase
        .from("conversation_messages")
        .insert({
          project_id: projectId,
          sender_role: "admin",
          text: turnResult.conversationalReply,
          turn_type: "new_message",
          call_session_id: callSessionId,
        })
        .select()
        .single()
    : { data: null };

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "evidence_extracted",
    payload: { evidence_count: turnResult.extractedEvidence.length },
    activity_summary:
      turnResult.extractedEvidence.length > 0
        ? `Captured ${turnResult.extractedEvidence.length} new piece(s) of information from the conversation.`
        : null,
  });

  return NextResponse.json({
    reply: replyMessage,
    extractedEvidenceCount: turnResult.extractedEvidence.length,
    newQuestionsCount: turnResult.gaps.length,
  });
}
