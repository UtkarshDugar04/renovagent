// The Application ↔ YOXA boundary — exactly one function.
//
// This is a stand-in for the real Swarm call. Everything upstream (the API
// route) and downstream (the Knowledge Update Protocol) is written against
// this exact request/response shape, so wiring in the real YOXA endpoint
// later is a one-function swap, not a rewrite.
//
// Real implementation should POST to process.env.YOXA_SWARM_ENDPOINT with
// this same TurnRequest and parse a TurnResponse back — see the
// architecture doc, Part 7 (Frontend / Application / YOXA Contract).

import type { Domain, EvidenceType, Confidence, Severity } from "@/lib/types/domain";

export type TurnType = "new_message" | "design_feedback" | "decision_resolution";

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

// STUB — no real reasoning happens here yet. It acknowledges the message,
// extracts nothing, and asks a generic first question only if the
// conversation looks brand new. Replace this function body once the YOXA
// Swarm endpoint exists; the signature should not need to change.
export async function processTurn(request: TurnRequest): Promise<TurnResponse> {
  const isFirstMessage = request.context.recentConversation.length === 0;

  // Per the Conversation Agent spec: an attachment the system can't yet
  // interpret must still be acknowledged as evidence — status Unresolved,
  // never silently dropped and never fabricated as understood.
  const attachmentEvidence: ExtractedEvidence[] = request.attachments.map((a) => ({
    domain: "spatial",
    evidenceType: "observation",
    statement: `Attachment received: ${a.label} (not yet interpreted — no image/document understanding wired up yet)`,
    confidence: "unknown",
  }));

  if (isFirstMessage) {
    return {
      conversationalReply:
        "Thanks for sharing that. To start building a real picture of your renovation — who's the project for, and what's the main thing that's not working about the space today?",
      extractedEvidence: attachmentEvidence,
      gaps: [],
      nextBestAction: "ask_conversation",
    };
  }

  return {
    conversationalReply:
      request.attachments.length > 0
        ? "Got that file — I can't actually interpret images or documents yet, so I've logged it against the project as unresolved for now rather than guessing what's in it."
        : "Got it — I've noted that. (Renovagent's reasoning isn't connected yet, so this is an acknowledgement only; nothing structured has been extracted from this message.)",
    extractedEvidence: attachmentEvidence,
    gaps: [],
    nextBestAction: "none",
  };
}
