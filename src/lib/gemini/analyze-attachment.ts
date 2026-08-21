// Per the Yoxa workflow context doc: everything that isn't the live-call
// transcript (photos, floor plans, site docs, quotations, regulatory refs)
// is processed here, outside Yoxa, at upload time, and written straight
// into this project's Renovation DNA as typed evidence.
//
// SIMULATED FOR NOW: real vision analysis (Gemini) is disabled — the
// free-tier daily quota (20 requests/day/model) doesn't hold up under
// real usage, and the alternative provider in use for text (Groq) only
// has one vision model with no documented PDF support, which is a real
// quality risk for a pipeline that leans on native PDF understanding.
// Rather than gamble on either, every attachment is honestly logged as
// received-but-not-analyzed — the same "unresolved, never fabricated"
// evidence the app already produces for a genuinely unsupported file, now
// produced for every file. This keeps the pipeline fully functional (real
// rows, real status transitions, real UI) without pretending to have
// understood something no model actually looked at. Swap the body of
// analyzeAttachment back to a real vision call (Gemini once quota
// resets, or Groq's qwen/qwen3.6-27b for images once validated) to
// restore real analysis — the input/output contract doesn't need to change.

import type { EvidenceInput, ConstraintInput, BudgetLineInput } from "@/lib/yoxa/tools/update-canonical-renovation-dna";

export interface AnalyzeAttachmentInput {
  bytes: Buffer;
  mimeType: string;
  label: string;
}

export interface AnalyzeAttachmentResult {
  evidence: EvidenceInput[];
  constraints: ConstraintInput[];
  budgetLines: BudgetLineInput[];
}

export async function analyzeAttachment(input: AnalyzeAttachmentInput): Promise<AnalyzeAttachmentResult> {
  return {
    evidence: [
      {
        domain: "spatial",
        evidenceType: "observation",
        statement: `Attachment received: ${input.label} (${input.mimeType}) — automatic analysis is temporarily unavailable, logged as unresolved rather than guessed.`,
        confidence: "unknown",
        status: "unresolved",
        source: `attachment:${input.label}`,
      },
    ],
    constraints: [],
    budgetLines: [],
  };
}
