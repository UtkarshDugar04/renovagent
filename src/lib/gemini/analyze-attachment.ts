// Per the Yoxa workflow context doc: everything that isn't the live-call
// transcript (photos, floor plans, site docs, quotations, regulatory refs)
// is processed here, outside Yoxa, at upload time, and written straight
// into this project's Renovation DNA as typed evidence.
//
// Runs on Groq (qwen/qwen3.6-27b, its vision model), not Gemini — Gemini's
// free-tier daily quota (20 requests/day/model) doesn't hold up under real
// usage (see process-turn.ts / generate-brief.ts for the same reasoning).
// Real vision analysis was previously disabled entirely for this reason;
// re-enabled here via Groq for images specifically.
//
// Groq's vision model has no documented PDF support (image_url content
// parts only, confirmed against its API types and docs) — a PDF or any
// other non-image attachment still gets the honest "received but not
// analyzed" placeholder below, same as every genuinely unsupported file
// already got before this change. This keeps the pipeline fully functional
// (real rows, real status transitions, real UI) without pretending to have
// understood something no model actually looked at.

import { createGroqClient, generateWithRetry } from "@/lib/groq/client";
import type { Domain, EvidenceType, Confidence } from "@/lib/types/domain";
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

const VISION_MODEL = "qwen/qwen3.6-27b";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // Groq's own documented per-request cap
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function unsupportedPlaceholder(label: string, mimeType: string, reason: string): AnalyzeAttachmentResult {
  return {
    evidence: [
      {
        domain: "spatial",
        evidenceType: "observation",
        statement: `Attachment received: ${label} (${mimeType}) — ${reason}, logged as unresolved rather than guessed.`,
        confidence: "unknown",
        status: "unresolved",
        source: `attachment:${label}`,
      },
    ],
    constraints: [],
    budgetLines: [],
  };
}

const DOMAINS: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
const EVIDENCE_TYPES: EvidenceType[] = [
  "aspiration", "requirement", "preference", "routine", "pain_point",
  "observation", "constraint", "priority", "decision", "trade_off",
  "assumption", "inference", "question", "conflict", "verification", "rejection",
];
const CONFIDENCE_LEVELS: Confidence[] = ["unknown", "low", "medium", "high"];
const HARDNESS = ["hard", "soft", "negotiable"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    evidence: {
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
      description: "What this image actually shows — never inferred beyond what's visible.",
    },
    constraints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          hardness: { type: "string", enum: HARDNESS },
          description: { type: "string" },
        },
        required: ["category", "hardness", "description"],
        additionalProperties: false,
      },
      description: "Only if this is a regulatory/society-rules/structural document that states an actual rule or limit — not inferred from a photo.",
    },
    budgetLines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          estimated: { type: "number" },
        },
        required: ["category", "estimated"],
        additionalProperties: false,
      },
      description: "Only if this is a quotation/estimate document stating an actual figure.",
    },
  },
  required: ["evidence", "constraints", "budgetLines"],
  additionalProperties: false,
};

const SYSTEM_INSTRUCTION = `You are analyzing one attachment uploaded to a home renovation project — a photo, floor plan, site document, quotation, or regulatory reference. This is document-derived evidence, processed once at upload time, independent of and prior to any conversation.

WHAT TO EXTRACT
Describe only what is actually visible or stated in this specific file. A floor plan or photo: rooms, approximate layout, visible fixtures, visible condition, visible dimensions if labeled. A regulatory/society-rules document: actual stated rules, as constraints. A quotation/estimate: actual stated figures, as budget lines. Most attachments are photos or floor plans — expect evidence to usually be your only output, constraints and budgetLines empty.

EVIDENCE DISCIPLINE — this matters as much as what you extract
- domain: almost always "spatial" for a photo or floor plan. Use "constraint" only for an actual regulatory/structural document, "budget" only for an actual quotation/estimate document.
- evidenceType: "observation" for what you can see, "constraint" for an explicit stated rule, "inference" for something you're concluding rather than directly reading.
- confidence: your confidence in accurately reading what the image shows, not confidence in any underlying fact. A clearly visible room layout is high confidence even though you have no way to verify its exact measurements.
- Never claim a measurement is exact from a photo alone — describe it as approximate. A vision-model read of a photo is never a verified measurement, regardless of how clear the image is.
- If the image shows nothing evaluable (blurry, irrelevant, unreadable), return an empty evidence array — do not invent content to avoid an empty result.

NEVER
Invent a room, dimension, or fixture not actually visible. Treat a visual read as a verified fact. Extract constraints or budget figures from a photo that isn't actually a regulatory document or quotation. Pad the output to look more thorough than the image actually supports.

Respond with a single JSON object matching the required schema exactly.`;

export async function analyzeAttachment(input: AnalyzeAttachmentInput): Promise<AnalyzeAttachmentResult> {
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(input.mimeType)) {
    return unsupportedPlaceholder(
      input.label,
      input.mimeType,
      "automatic analysis currently only covers image files (JPEG/PNG/WebP/GIF), not this file type"
    );
  }
  if (input.bytes.length > MAX_IMAGE_BYTES) {
    return unsupportedPlaceholder(
      input.label,
      input.mimeType,
      `image is ${Math.round(input.bytes.length / 1024 / 1024)}MB, over the analyzable size limit`
    );
  }

  try {
    const groq = createGroqClient();
    const dataUrl = `data:${input.mimeType};base64,${input.bytes.toString("base64")}`;

    const result = await generateWithRetry(() =>
      groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          {
            role: "user",
            content: [
              { type: "text", text: `Attachment label: ${input.label}` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "attachment_analysis", schema: RESPONSE_SCHEMA, strict: true } },
      })
    );

    const raw = result.choices[0]?.message?.content;
    if (!raw) return unsupportedPlaceholder(input.label, input.mimeType, "the vision model returned no result");

    const parsed = JSON.parse(raw) as {
      evidence?: { domain: Domain; evidenceType: EvidenceType; statement: string; confidence: Confidence }[];
      constraints?: { category: string; hardness: "hard" | "soft" | "negotiable"; description: string }[];
      budgetLines?: { category: string; estimated: number }[];
    };

    const source = `attachment:${input.label}`;

    return {
      evidence: (parsed.evidence ?? []).map((e) => ({
        domain: e.domain,
        evidenceType: e.evidenceType,
        statement: e.statement,
        status: "inferred",
        confidence: e.confidence,
        authority: "d1_recommendation",
        source,
      })),
      constraints: (parsed.constraints ?? []).map((c) => ({
        category: c.category,
        hardness: c.hardness,
        status: "unresolved",
        description: c.description,
      })),
      budgetLines: (parsed.budgetLines ?? []).map((b) => ({
        category: b.category,
        estimated: b.estimated,
      })),
    };
  } catch (err) {
    console.error("analyzeAttachment: Groq vision call failed", err);
    return unsupportedPlaceholder(input.label, input.mimeType, "automatic analysis failed on this attempt");
  }
}
