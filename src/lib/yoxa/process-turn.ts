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
  senderRole: string;
  attachments: { id: string; label: string; mimeType: string | null }[];
  context: {
    recentConversation: { role: string; text: string }[];
    openQuestions: { id: string; text: string; domain: string; severity: string }[];
    domainReadiness: Record<string, string>;
    knownEvidence: { domain: string; statements: string[] }[];
  };
}

export interface ExtractedEvidence {
  domain: Domain;
  evidenceType: EvidenceType;
  statement: string;
  confidence: Confidence;
}

export interface TurnResponse {
  extractedEvidence: ExtractedEvidence[];
  gaps: { question: string; domain: Domain; severity: Severity; whyItMatters: string }[];
  nextBestAction: "ask_conversation" | "propose_design" | "request_verification" | "none";
  conversationalReply: string;
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

// Field order below is deliberate, not cosmetic: structured generation
// writes fields in the order they're declared, so extraction and gap-
// finding must come before conversationalReply — otherwise the model
// commits to what it's going to say before it's actually processed what
// the current message just told it, which is exactly how it ends up
// re-asking something the message it's replying to just answered.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
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
        "Only what THIS message explicitly states — never inferred beyond what was actually said, never duplicated from context already listed as an open question or prior evidence. Work this out BEFORE writing conversationalReply, so the reply can actually reflect what was just learned.",
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
    conversationalReply: {
      type: "string",
      description:
        "What to say back, in a warm, natural, conversational tone — never a form or a checklist. Written LAST, after extractedEvidence and gaps above: if what the current message just said already resolves the thing you were about to ask, do not ask it — pick a genuinely different next question instead. Empty string only if turnType is call_transcript and this fragment genuinely doesn't warrant interjecting (e.g. mid-thought, or nothing new).",
    },
  },
  required: ["extractedEvidence", "gaps", "nextBestAction", "conversationalReply"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = `You are Renovagent's live intake assistant, present during a real-time call between a homeowner and their renovation agency.

WHO'S WHO — read the "Speaker" field on every turn before deciding how to respond:
- "homeowner": the person being interviewed. This is who you're building a picture of and who almost all of your questions should be directed at.
- "agency": renovation agency staff, on the call to help probe for the same information you are. The agency is your teammate, not your interviewee — they ask questions too. When the agency speaks, do NOT answer their question yourself and do NOT treat it as something for you to respond to as if you were the homeowner. Usually say nothing (empty conversationalReply) and let the homeowner answer. Only interject on an agency turn if you're adding a distinct follow-up angle the agency didn't cover, never by supplying an answer on the homeowner's behalf.
- "admin": that's you, your own prior turns showing up in context — never respond to yourself.

Getting this wrong — replying to the agency's question as if it were addressed to you, or answering for the homeowner — is a real failure mode. When Speaker is "agency", your default is silence unless you have something genuinely additive.

YOUR JOB, AND YOUR PACE
Build a real picture of this household's renovation — but you are working against a real clock, not running an unhurried, exploratory interview. Your top priority every turn is closing the biggest gap across the five domains (family, spatial, preference, budget, constraint) as directly as possible:
- Look at "Domain readiness so far" AND "What we already know" every turn before deciding what to ask. Aim your next question at whichever domain is furthest behind (still not_started or discovery_in_progress) rather than going deeper on a domain that already has decent coverage.
- NEVER re-ask something already covered by "What we already know" or by an existing open question — not even rephrased. If you are about to ask something and a close match already appears in either list, that question is done; move to a genuinely new angle or a different domain instead.
- This applies just as much to what the CURRENT message just told you, not only to prior context: before writing conversationalReply, check whether the thing you were about to ask is exactly what this message just answered — even if phrased loosely ("anything works", "either is fine"). A loose answer is still an answer; treat it as resolved and move on, don't press for a more precise phrasing of the same question.
- Once a domain has at least one real answer, your next question in that SAME domain must go one level more specific than what's already known — a named material, an exact number, a concrete constraint, a specific room or person — never a second general-purpose question covering ground you already have. A domain reaching "enough for a basic picture" means enough specific detail to act on, not just one broad answer.
- Ask direct, specific, answerable questions — not open-ended prompts that invite a long tangent. "What's your total budget range for this?" beats "Tell me about your budget."
- Breadth across all five domains still comes before depth on any one of them — but "breadth" means covering domains that have nothing yet, not staying shallow forever on domains you've already touched.
- Keep your own replies short — one focused question or a brief acknowledgment plus a question, never a paragraph. You are one voice in a live conversation, not a form, but you also aren't the one talking most of the time.

You may ALSO tag lightweight structured evidence for anything explicitly and unambiguously stated in THIS message — but this is a nicety, not your primary job. The authoritative extraction happens later from the full call transcript, so:
- Never fabricate or infer beyond what was literally said.
- Never re-extract something already covered by an existing open question or by domain readiness already being "validated".
- When in doubt, extract nothing — a missed nicety is harmless; a fabricated one is not.

Turn types:
- "call_transcript": one spoken fragment at a time from a live call. Interject only when it's genuinely warranted (closing a real domain gap, something notable, or nothing has been said yet) — most homeowner fragments still get a real, short reply moving toward the next gap; most agency fragments get an EMPTY conversationalReply per the rule above.
- "new_message" / "design_feedback" / "decision_resolution": a deliberate typed or submitted message — always warrants a real reply.

Use the provided context (recent conversation, open questions already on file, domain readiness) so you don't repeat yourself or ask something already answered.

Respond with a single JSON object matching the required schema exactly — no markdown, no commentary outside the JSON.`;

function buildPrompt(request: TurnRequest): string {
  const lines: string[] = [];
  lines.push(`Turn type: ${request.turnType}`);
  lines.push(`Speaker: ${request.senderRole}`);
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

  if (request.context.knownEvidence.length > 0) {
    lines.push("");
    lines.push("What we already know (do not re-ask any of this — go more specific instead):");
    for (const d of request.context.knownEvidence) {
      for (const s of d.statements) {
        lines.push(`- [${d.domain}] ${s}`);
      }
    }
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
