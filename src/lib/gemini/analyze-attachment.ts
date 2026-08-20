// Per the Yoxa workflow context doc: everything that isn't the live-call
// transcript (photos, floor plans, site docs, quotations, regulatory refs)
// is processed here, outside Yoxa, at upload time, and written straight
// into this project's Renovation DNA as typed evidence. Photos/scans never
// produce anything stronger than "inferred" or "unresolved" evidence — a
// model reading an image isn't a verification. Text-bearing documents
// (society rules, regulatory refs, quotations) can additionally produce
// constraints and budget lines.

import { Type } from "@google/genai";
import { createGeminiClient, generateWithRetry, ANALYSIS_MODEL } from "@/lib/gemini/client";
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

const EMPTY_RESULT: AnalyzeAttachmentResult = { evidence: [], constraints: [], budgetLines: [] };

// Gemini's inline-data request limit is ~20MB; stay comfortably under it
// rather than reach for the Files API for what is, today, floor plans and
// site photos — revisit if LiDAR/video uploads get added to the UI.
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

const DOMAINS = ["family", "spatial", "preference", "budget", "constraint"];
const EVIDENCE_TYPES = [
  "aspiration", "requirement", "preference", "routine", "pain_point",
  "observation", "constraint", "priority", "decision", "trade_off",
  "assumption", "inference", "question", "conflict", "verification", "rejection",
];
const CONFIDENCE_LEVELS = ["unknown", "low", "medium", "high"];
// Never "explicit" or "verified" here — those describe direct statements
// and human confirmation. A model reading a photo or a PDF produces
// neither.
const EVIDENCE_STATUSES = ["inferred", "unresolved"];
const HARDNESS_LEVELS = ["hard", "soft", "negotiable"];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          domain: { type: Type.STRING, enum: DOMAINS },
          evidenceType: { type: Type.STRING, enum: EVIDENCE_TYPES },
          statement: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: CONFIDENCE_LEVELS },
          status: { type: Type.STRING, enum: EVIDENCE_STATUSES },
        },
        required: ["domain", "evidenceType", "statement", "confidence", "status"],
      },
    },
    constraints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          hardness: { type: Type.STRING, enum: HARDNESS_LEVELS },
          description: { type: Type.STRING },
        },
        required: ["category", "hardness", "description"],
      },
      description: "Only from a text document clearly stating a rule/regulation/restriction (society bylaws, building code reference) — never inferred from a photo.",
    },
    budgetLines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          estimated: { type: Type.NUMBER },
          quoted: { type: Type.NUMBER },
        },
        required: ["category"],
      },
      description: "Only from a document that is clearly a quotation or cost estimate — never inferred from a photo.",
    },
  },
  required: ["evidence", "constraints", "budgetLines"],
};

const SYSTEM_INSTRUCTION = `You analyze a single file uploaded to a home renovation project — a photo, floor plan, site document, regulatory reference, or vendor quotation. Determine what kind of file this actually is and extract accordingly:

- A PHOTO, floor plan image, or scanned/photographed room: describe what it shows as spatial/preference/family evidence (room dimensions if estimable, layout, condition, notable features, style cues). Never claim certainty about measurements you're estimating visually — use evidenceType "observation" or "inference", status "inferred" for a reasonably confident read, or "unresolved" if you genuinely can't make out something important. Do not populate constraints or budgetLines from a photo.

- A TEXT DOCUMENT (society/building rules, regulatory reference, vendor quotation, cost estimate): extract concrete constraints (rules/restrictions with their hardness — "hard" for a legal/society requirement, "soft" for a guideline, "negotiable" for something that could be appealed) and budget lines (category + amount, "quoted" if it's a real vendor number, "estimated" if it's a ballpark). Also extract any evidence a homeowner would want captured (e.g. a stated requirement in the document).

- Anything you genuinely cannot interpret (illegible, wrong format, empty): return a single evidence item, domain "spatial", evidenceType "observation", status "unresolved", confidence "unknown", statement acknowledging the file was received but not understood. Never fabricate content for a file you can't actually read.

Be conservative — omit anything you're not reasonably confident about rather than guessing. Ground every statement in what's actually visible/readable in the file, not generic renovation assumptions.`;

export async function analyzeAttachment(input: AnalyzeAttachmentInput): Promise<AnalyzeAttachmentResult> {
  const isSupportedType = input.mimeType.startsWith("image/") || input.mimeType === "application/pdf";

  if (!isSupportedType || input.bytes.length > MAX_INLINE_BYTES) {
    return {
      evidence: [
        {
          domain: "spatial",
          evidenceType: "observation",
          statement: `Attachment received: ${input.label} (${input.mimeType}) — ${
            !isSupportedType ? "unsupported file type" : "file too large"
          } for automatic analysis, logged as unresolved rather than guessed.`,
          confidence: "unknown",
          status: "unresolved",
        },
      ],
      constraints: [],
      budgetLines: [],
    };
  }

  try {
    const ai = createGeminiClient();
    const result = await generateWithRetry(() =>
      ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: input.mimeType, data: input.bytes.toString("base64") } },
              { text: `Filename: ${input.label}` },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      })
    );

    const raw = result.text;
    if (!raw) return EMPTY_RESULT;

    const parsed = JSON.parse(raw) as AnalyzeAttachmentResult;
    return {
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map((e) => ({ ...e, source: `attachment:${input.label}` })) : [],
      constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
      budgetLines: Array.isArray(parsed.budgetLines) ? parsed.budgetLines : [],
    };
  } catch (err) {
    console.error("analyzeAttachment: Gemini call failed", err);
    // Surfaces as attachments.status = 'failed' to the caller — never
    // silently pretend the file was understood.
    throw err;
  }
}
