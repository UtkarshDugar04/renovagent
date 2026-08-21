// The Application <-> conversational-intelligence boundary — exactly one
// function. Everything upstream (the API route) and downstream (the
// Knowledge Update Protocol) is written against this exact request/response
// shape.
//
// This is real-time conversational quality only, not the authoritative
// evidence extraction — that stays server-side in Yoxa via
// ingestConversationBrief, run once against the full end-of-call brief.
// What gets extracted here is a best-effort, lightweight nicety so the UI
// doesn't feel dead while the call is happening; it is never the source of
// truth Design/Validation agents build on.
//
// Runs on Groq (text-only, no vision needed here) rather than Gemini —
// Gemini's free tier caps at 20 requests/day per model, which live
// conversation traffic blows through immediately; Groq's free tier has
// much more headroom for exactly this kind of high-volume, latency-
// sensitive text call.

import { createGroqClient, generateWithRetry, CONVERSATION_MODEL } from "@/lib/groq/client";
import type { Domain, EvidenceType, Confidence, Severity } from "@/lib/types/domain";

export type TurnType = "new_message" | "design_feedback" | "decision_resolution" | "call_transcript";

export interface TurnRequest {
  projectId: string;
  turnType: TurnType;
  message: string;
  attachments: { id: string; label: string; mimeType: string | null }[];
  context: {
    recentConversation: { role: string; text: string }[];
    openQuestions: { id: string; text: string; domain: string; severity: string }[];
    domainReadiness: Record<string, string>;
  };
}

export interface ExtractedEvidence {
  domain: Domain;
  evidenceType: EvidenceType;
  statement: string;
  confidence: Confidence;
}

export interface TurnResponse {
  conversationalReply: string;
  extractedEvidence: ExtractedEvidence[];
  gaps: { question: string; domain: Domain; severity: Severity; whyItMatters: string }[];
  nextBestAction: "ask_conversation" | "propose_design" | "request_verification" | "none";
}

const DOMAINS: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
const EVIDENCE_TYPES: EvidenceType[] = [
  "aspiration", "requirement", "preference", "routine", "pain_point",
  "observation", "constraint", "priority", "decision", "trade_off",
  "assumption", "inference", "question", "conflict", "verification", "rejection",
];
const CONFIDENCE_LEVELS: Confidence[] = ["unknown", "low", "medium", "high"];
const SEVERITIES: Severity[] = ["e0", "e1", "e2", "e3", "e4", "e5"];
const NEXT_ACTIONS = ["ask_conversation", "propose_design", "request_verification", "none"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    conversationalReply: {
      type: "string",
      description:
        "What to say back, in a warm, natural, conversational tone — never a form or a checklist. Empty string only if turnType is call_transcript and this fragment genuinely doesn't warrant interjecting (e.g. mid-thought, or nothing new).",
    },
    extractedEvidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string", enum: DOMAINS },
          evidenceType: { type: "string", enum: EVIDENCE_TYPES },
          statement: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE_LEVELS },
        },
        required: ["domain", "evidenceType", "statement", "confidence"],
        additionalProperties: false,
      },
      description:
        "Only what THIS message explicitly states — never inferred beyond what was actually said, never duplicated from context already listed as an open question or prior evidence.",
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          domain: { type: "string", enum: DOMAINS },
          severity: { type: "string", enum: SEVERITIES },
          whyItMatters: { type: "string" },
        },
        required: ["question", "domain", "severity", "whyItMatters"],
        additionalProperties: false,
      },
      description: "New open questions this message surfaced — only genuinely new ones, not restating existing open questions.",
    },
    nextBestAction: { type: "string", enum: NEXT_ACTIONS },
  },
  required: ["conversationalReply", "extractedEvidence", "gaps", "nextBestAction"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = `You are Renovagent's live intake assistant, present during a real-time call between a homeowner and their renovation agency.

Your job right now is conversational, not clerical: build a real picture of this household's renovation by asking good, specific, warm follow-up questions — never a checklist, never robotic. You are one voice in a live conversation, not a form.

You may ALSO tag lightweight structured evidence for anything explicitly and unambiguously stated in THIS message — but this is a nicety, not your primary job. The authoritative extraction happens later from the full call transcript, so:
- Never fabricate or infer beyond what was literally said.
- Never re-extract something already covered by an existing open question or by domain readiness already being "validated".
- When in doubt, extract nothing — a missed nicety is harmless; a fabricated one is not.

Turn types:
- "call_transcript": one spoken fragment at a time from a live call. Interject only when it's genuinely warranted (something notable, a good follow-up moment, or nothing has been said yet) — most fragments should get an EMPTY conversationalReply, since a human listening in wouldn't speak after every sentence either.
- "new_message" / "design_feedback" / "decision_resolution": a deliberate typed or submitted message — always warrants a real reply.

Use the provided context (recent conversation, open questions already on file, domain readiness) so you don't repeat yourself or ask something already answered.

Respond with a single JSON object matching the required schema exactly — no markdown, no commentary outside the JSON.`;

function buildPrompt(request: TurnRequest): string {
  const lines: string[] = [];
  lines.push(`Turn type: ${request.turnType}`);
  lines.push(`Message: ${request.message || "(no text — attachment(s) only)"}`);

  if (request.attachments.length > 0) {
    lines.push(
      `Attachments on this message: ${request.attachments.map((a) => `${a.label} (${a.mimeType ?? "unknown type"})`).join(", ")} — these are being analyzed separately; do not claim to have interpreted their content.`
    );
  }

  lines.push("");
  lines.push("Domain readiness so far:");
  for (const domain of DOMAINS) {
    lines.push(`- ${domain}: ${request.context.domainReadiness[domain] ?? "not_started"}`);
  }

  if (request.context.openQuestions.length > 0) {
    lines.push("");
    lines.push("Already-open questions (do not re-ask these):");
    for (const q of request.context.openQuestions) {
      lines.push(`- [${q.domain}/${q.severity}] ${q.text}`);
    }
  }

  if (request.context.recentConversation.length > 0) {
    lines.push("");
    lines.push("Recent conversation (oldest first):");
    for (const m of request.context.recentConversation) {
      lines.push(`${m.role}: ${m.text}`);
    }
  }

  return lines.join("\n");
}

const EMPTY_RESPONSE: TurnResponse = {
  conversationalReply: "",
  extractedEvidence: [],
  gaps: [],
  nextBestAction: "none",
};

export async function processTurn(request: TurnRequest): Promise<TurnResponse> {
  try {
    const groq = createGroqClient();
    const result = await generateWithRetry(() =>
      groq.chat.completions.create({
        model: CONVERSATION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: buildPrompt(request) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "turn_response", schema: RESPONSE_SCHEMA, strict: true } },
      })
    );

    const raw = result.choices[0]?.message?.content;
    if (!raw) return EMPTY_RESPONSE;

    const parsed = JSON.parse(raw) as TurnResponse;
    return {
      conversationalReply: parsed.conversationalReply ?? "",
      extractedEvidence: Array.isArray(parsed.extractedEvidence) ? parsed.extractedEvidence : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      nextBestAction: parsed.nextBestAction ?? "none",
    };
  } catch (err) {
    // A conversational-quality failure must never break the call or the
    // Knowledge Update Protocol route — degrade to silence, not an error.
    console.error("processTurn: Groq call failed", err);
    return EMPTY_RESPONSE;
  }
}
