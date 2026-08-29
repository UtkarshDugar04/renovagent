import { NextRequest } from "next/server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { getCanonicalRenovationDna } from "@/lib/yoxa/tools/get-canonical-renovation-dna";
import { reviewSpatialEvidence } from "@/lib/yoxa/tools/review-spatial-evidence";
import { updateCanonicalRenovationDna } from "@/lib/yoxa/tools/update-canonical-renovation-dna";
import { recordEngineArtifact } from "@/lib/yoxa/tools/record-engine-artifact";
import { recordPreferenceMoodboardImages } from "@/lib/yoxa/tools/record-preference-moodboard-images";
import { recordDesignOptionImages } from "@/lib/yoxa/tools/record-design-option-images";
import { recordSourcedProducts } from "@/lib/yoxa/tools/record-sourced-products";
import { recordPendingOrchestrationState } from "@/lib/yoxa/tools/record-pending-orchestration-state";
import { recordReadinessAssessment } from "@/lib/yoxa/tools/record-readiness-assessment";
import { recordProposedDesignPackage } from "@/lib/yoxa/tools/record-proposed-design-package";
import { calculateBudgetScenarios } from "@/lib/yoxa/tools/calculate-budget-scenarios";
import { recordExperienceFeedback } from "@/lib/yoxa/tools/record-experience-feedback";
import { applyDependencyImpactPatch } from "@/lib/yoxa/tools/apply-dependency-impact-patch";
import { generateRoleHandoffBrief } from "@/lib/yoxa/tools/generate-role-handoff-brief";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST/GET/DELETE /api/mcp
// The real Model Context Protocol server Yoxa's "MCP Tool" connections talk
// to — one connection, multiple tools, exactly the shape Yoxa's MCP
// Connection screen expects (Connection Name, Server URL, Bearer token).
// This is NOT the same protocol as the plain REST routes under
// /api/yoxa/projects/** — those stay in place for any caller that still
// wants a plain HTTP/OpenAPI integration, but Yoxa agents attached via an
// "MCP Tool" action reach the project's Renovation DNA through here.
//
// Every tool below wraps the exact same shared logic the REST routes call
// (src/lib/yoxa/tools/*) — there is exactly one implementation per
// operation, not one per transport.
//
// Runs stateless: a fresh McpServer + transport per request, matching how
// Vercel's serverless functions actually execute (no persistent connection
// to hold a session open across invocations). enableJsonResponse keeps
// every response a single JSON body rather than an SSE stream, which is
// both simpler to reason about and more robust for a request/response tool
// caller like Yoxa.

const domainEnum = z.enum(["family", "spatial", "preference", "budget", "constraint"]);
const evidenceTypeEnum = z.enum([
  "aspiration", "requirement", "preference", "routine", "pain_point",
  "observation", "constraint", "priority", "decision", "trade_off",
  "assumption", "inference", "question", "conflict", "verification", "rejection",
]);
const evidenceStatusEnum = z.enum([
  "explicit", "verified", "inferred", "assumed", "unresolved", "conflicted", "stale", "superseded",
]);
const confidenceEnum = z.enum(["unknown", "low", "medium", "high"]);
const authorityEnum = z.enum(["d0_agent", "d1_recommendation", "d2_homeowner", "d3_professional", "d4_external"]);
const severityEnum = z.enum(["e0", "e1", "e2", "e3", "e4", "e5"]);
const hardnessEnum = z.enum(["hard", "soft", "negotiable"]);
const constraintStatusEnum = z.enum(["confirmed", "provisional", "unresolved", "requires_verification", "cleared"]);
const readinessStateEnum = z.enum([
  "not_started", "discovery_in_progress", "partially_understood", "sufficient_for_validation", "validated",
]);
const sentimentEnum = z.enum(["like", "dislike", "neutral"]);
const decisionMakerRoleEnum = z.enum(["homeowner", "agency", "admin"]);

const projectIdSchema = { projectId: z.string().uuid().describe("The project's id, exactly as provided in the call context — never guessed.") };

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// Yoxa's model fills every optional schema field explicitly rather than
// omitting absent ones — confirmed via a live MCP error (Zod rejecting
// `null` on .optional() fields the model never intended to set). Schemas
// below accept null via .nullish() so the call itself doesn't fail
// validation; this strips those nulls back to undefined right at the
// boundary so the rest of the app's types (which model "absent" as
// undefined only) never see the difference.
type StripNull<T> = T extends null
  ? undefined
  : T extends (infer U)[]
    ? StripNull<U>[]
    : T extends object
      ? { [K in keyof T]: StripNull<T[K]> }
      : T;

function stripNulls<T>(value: T): StripNull<T> {
  if (value === null) return undefined as unknown as StripNull<T>;
  if (Array.isArray(value)) return value.map((v) => stripNulls(v)) as unknown as StripNull<T>;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripNulls(v);
    return out as StripNull<T>;
  }
  return value as StripNull<T>;
}

function buildServer() {
  const server = new McpServer({ name: "renovagent", version: "1.0.0" });
  const supabase = createServiceClient();

  server.registerTool(
    "getCanonicalRenovationDna",
    {
      description: "Read the full canonical Renovation DNA for one project — household, evidence, questions, assumptions, decisions, trade-offs, conflicts, readiness, constraints, budget lines, spatial elements, design rounds, design options, design option feedback.",
      inputSchema: projectIdSchema,
    },
    async ({ projectId }) => {
      try {
        return textResult(await getCanonicalRenovationDna(supabase, projectId));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "reviewSpatialEvidence",
    {
      description: "Gather spatial-domain evidence and elements, with unresolved items and open conflicts already flagged, for the agent to compare.",
      inputSchema: projectIdSchema,
    },
    async ({ projectId }) => {
      try {
        return textResult(await reviewSpatialEvidence(supabase, projectId));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  // Originally one combined tool (evidence + questions + conflicts +
  // householdMembers + constraints + budgetLines + spatialElements all as
  // parameters on a single call). That schema was too large/complex for
  // Yoxa's configured model provider to bind at all — every agent using it
  // failed instantly with model.schema_incompatible, before any real
  // execution ever happened. Split into seven focused tools below, each
  // calling the same shared updateCanonicalRenovationDna function with only
  // its one field populated — smaller, simpler schemas per call, and each
  // agent only needs the ones its own writes actually use.

  const evidenceItemSchema = z.object({
    domain: domainEnum,
    evidenceType: evidenceTypeEnum,
    statement: z.string(),
    status: evidenceStatusEnum.nullish(),
    confidence: confidenceEnum.nullish(),
    authority: authorityEnum.nullish(),
    source: z.string().nullish(),
    contradictsEvidenceId: z.string().uuid().nullish(),
    supersededById: z.string().uuid().nullish(),
  });

  server.registerTool(
    "recordEvidence",
    {
      description: "Write new evidence to a project's Renovation DNA, each item carrying its own canonical classification (domain, status, confidence, authority). The most commonly used DNA write — used by nearly every agent in this flow.",
      inputSchema: {
        ...projectIdSchema,
        evidence: z.array(evidenceItemSchema).min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, evidence } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { evidence }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "ingestConversationBrief",
    {
      description: "The mandatory first call after conversation_brief_submitted fires. Parses the Gemini Conversation Agent's end-of-call markdown brief into classified evidence across family, preference (verbal), budget, and constraint (never spatial — spatial evidence only ever comes from document upload processing, not this brief). Same write path as recordEvidence; this is the named entry point Evidence Curator must call before any other agent reads the Renovation DNA in this run.",
      inputSchema: {
        ...projectIdSchema,
        evidence: z.array(evidenceItemSchema).min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, evidence } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { evidence }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordQuestions",
    {
      description: "Write new open questions to a project's Renovation DNA — real gaps, each with severity and whether it blocks readiness.",
      inputSchema: {
        ...projectIdSchema,
        newQuestions: z
          .array(
            z.object({
              domain: domainEnum,
              questionText: z.string(),
              whyItMatters: z.string().nullish(),
              severity: severityEnum.nullish(),
              blocksReadiness: z.boolean().nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, newQuestions } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { newQuestions }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordConflicts",
    {
      description: "Link two existing evidence items as a conflict — both ids must already exist from a prior recordEvidence call in this same run. Never resolves the conflict, only represents it.",
      inputSchema: {
        ...projectIdSchema,
        conflicts: z
          .array(
            z.object({
              evidenceAId: z.string().uuid(),
              evidenceBId: z.string().uuid(),
              reason: z.string(),
              affectedDomains: z.array(domainEnum).nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, conflicts } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { conflicts }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordHouseholdMembers",
    {
      description: "Write new household members. Only ever sourced from conversational evidence — never inferred from documents.",
      inputSchema: {
        ...projectIdSchema,
        householdMembers: z
          .array(
            z.object({
              name: z.string(),
              roleInHousehold: z.string().nullish(),
              isPrimaryContact: z.boolean().nullish(),
              accessibilityNeeds: z.string().nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, householdMembers } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { householdMembers }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordConstraints",
    {
      description: "Write structured constraint records — category, hardness (hard/soft/negotiable), status, description. Used by Constraint Intelligence for its classified Constraint Framework.",
      inputSchema: {
        ...projectIdSchema,
        constraints: z
          .array(
            z.object({
              category: z.string(),
              hardness: hardnessEnum,
              status: constraintStatusEnum.nullish(),
              description: z.string(),
              evidenceIds: z.array(z.string().uuid()).nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, constraints } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { constraints }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordBudgetLines",
    {
      description: "Write structured per-category budget lines — probable range, priority tier. Used by Budget Intelligence for its allocation model.",
      inputSchema: {
        ...projectIdSchema,
        budgetLines: z
          .array(
            z.object({
              category: z.string(),
              probableLow: z.number().nullish(),
              probableHigh: z.number().nullish(),
              estimated: z.number().nullish(),
              quoted: z.number().nullish(),
              confirmed: z.number().nullish(),
              priorityTier: z.string().nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, budgetLines } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { budgetLines }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordSpatialElements",
    {
      description: "Write structured spatial elements — room, type, fixed named attributes (approxSqm, layout, adjacentRooms, notes — not a free-form object), certainty, requiresVerification. Used by Spatial Intelligence for its Spatial Model.",
      inputSchema: {
        ...projectIdSchema,
        spatialElements: z
          .array(
            z.object({
              room: z.string().nullish(),
              elementType: z.string(),
              attributes: z
                .object({
                  approxSqm: z.number().nullish(),
                  layout: z.string().nullish(),
                  adjacentRooms: z.array(z.string()).nullish(),
                  notes: z.string().nullish(),
                })
                .nullish(),
              certainty: confidenceEnum,
              requiresVerification: z.boolean().nullish(),
              evidenceIds: z.array(z.string().uuid()).nullish(),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, spatialElements } = stripNulls(raw);
        return textResult(await updateCanonicalRenovationDna(supabase, projectId, { spatialElements }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordEngineArtifact",
    {
      description: "Store a domain intelligence engine's single composed visual — a persona document, a floor-plan image, a P&L-styled budget breakdown, a constraint summary — rendered on Renovagent's own dashboard, not Yoxa's interface. Provide exactly one of content or imageUrl. content is static HTML rendered inside a fully sandboxed iframe (scripts never execute regardless of content) — use for Family's persona, Budget's breakdown, Constraint's summary. imageUrl is the result of an Output Tool: Image call on this agent — use for Spatial's floor plan. For Preference's moodboard (many independently-reactable images, not one document), call recordPreferenceMoodboardImages instead.",
      inputSchema: {
        ...projectIdSchema,
        engine: domainEnum,
        artifactType: z.string().describe("e.g. persona, floor_plan, budget_breakdown, summary."),
        content: z.string().nullish().describe("Static HTML content. Required unless imageUrl is given."),
        imageUrl: z.string().nullish().describe("Result of an Output Tool: Image call. Required unless content is given."),
      },
    },
    async (raw) => {
      try {
        const { projectId, engine, artifactType, content, imageUrl } = stripNulls(raw);
        return textResult(
          await recordEngineArtifact(supabase, projectId, { engine, artifactType, content, imageUrl })
        );
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordPreferenceMoodboardImages",
    {
      description: "Add one or more real generated images to the Preference engine's moodboard, each independently visible and reactable (thumbs up/down/save) by the homeowner and agency. Each imageUrl is the result of an Output Tool: Image call on this agent — generate a few style/material reference images per what preference evidence supports, then call this once with all of them.",
      inputSchema: {
        ...projectIdSchema,
        images: z
          .array(
            z.object({
              imageUrl: z.string().describe("Result of an Output Tool: Image call."),
              caption: z.string().nullish().describe("Short caption describing what this image shows."),
              roomOrTheme: z.string().nullish().describe("e.g. kitchen, living room, colour palette."),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, images } = stripNulls(raw);
        return textResult(await recordPreferenceMoodboardImages(supabase, projectId, { images }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordPendingOrchestrationState",
    {
      description: "Log a bounded next-action plan, owners, and re-entry point for a project — Planning & Orchestration's reconciliation summary, shown live in the project's activity feed.",
      inputSchema: {
        ...projectIdSchema,
        summary: z.string().describe("Human-readable orchestration summary, shown in the project's activity feed."),
        pendingActions: z
          .array(
            z.object({
              description: z.string(),
              owner: z.string().nullish().describe("Who owns this action, e.g. a household member or professional role."),
              dueContext: z.string().nullish().describe("Free-text timing context, not a hard deadline."),
            })
          )
          .nullish(),
        escalationLevel: severityEnum.nullish(),
      },
    },
    async (raw) => {
      try {
        const { projectId, summary, pendingActions, escalationLevel } = stripNulls(raw);
        return textResult(
          await recordPendingOrchestrationState(supabase, projectId, {
            summary,
            pendingActions,
            escalationLevel,
          })
        );
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordReadinessAssessment",
    {
      description: "Persist a per-domain readiness gate decision for a project — the Validation Agent's real, independent assessment, one entry per domain checked.",
      inputSchema: {
        ...projectIdSchema,
        assessments: z
          .array(
            z.object({
              domain: domainEnum,
              state: readinessStateEnum,
              reason: z.string().nullish().describe("Free-text explanation, blockers, and accepted uncertainty for this domain's gate decision."),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, assessments } = stripNulls(raw);
        return textResult(await recordReadinessAssessment(supabase, projectId, { assessments }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordProposedDesignPackage",
    {
      description: "Register proposed (not approved) design options for a project — the Design Agent's option registry against a design round. Never marks anything approved or construction-ready.",
      inputSchema: {
        ...projectIdSchema,
        roundNumber: z.number().int().nullish().describe("Existing or new design round number. Omit to start a new round automatically."),
        options: z
          .array(
            z.object({
              label: z.string(),
              rationale: z.string(),
              satisfiesEvidenceIds: z.array(z.string().uuid()).nullish(),
              tradeOffs: z.array(z.object({ gained: z.string(), sacrificed: z.string() })).nullish(),
              costBand: z
                .object({ low: z.number(), high: z.number(), confidence: confidenceEnum })
                .nullish(),
              sourcingStatus: z.enum(["not_evaluated", "grounded", "indicative", "ungrounded"]).nullish(),
              whatItWouldFeelLike: z.string().nullish(),
              visibleToHomeowner: z.boolean().nullish().describe("Defaults to false — hidden from the homeowner until the agency releases it."),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, roundNumber, options } = stripNulls(raw);
        return textResult(await recordProposedDesignPackage(supabase, projectId, { roundNumber, options }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordDesignOptionImages",
    {
      description: "Attach real generated visuals to an already-registered design option (call recordProposedDesignPackage first and use the returned option id). Each imageUrl is the result of an Output Tool: Image call on this agent — describe that specific option's actual chosen materials and style in the image prompt (e.g. if the option specifies marble, the image prompt must describe marble) so the visual genuinely reflects the option, not a generic room. Call once per option with one or more angles.",
      inputSchema: {
        ...projectIdSchema,
        designOptionId: z.string().uuid(),
        images: z
          .array(
            z.object({
              imageUrl: z.string().describe("Result of an Output Tool: Image call."),
              angle: z.string().nullish().describe("e.g. 'entrance view', 'cabinetry detail'."),
              materialsShown: z.array(z.string()).nullish().describe("Materials visible in this specific image, e.g. ['marble countertop', 'terracotta backsplash']."),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, designOptionId, images } = stripNulls(raw);
        return textResult(await recordDesignOptionImages(supabase, projectId, { designOptionId, images }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordSourcedProducts",
    {
      description: "Record the real vendors and products Sourcing found for an already-registered design option (call recordProposedDesignPackage first and use the returned option id) — real vendor name, real product name, the real listing URL Search Online Product Listings actually returned, and its real price in INR if known. Never invent a vendor, product, or price that wasn't actually returned by a search. Call once per option with one or more products.",
      inputSchema: {
        ...projectIdSchema,
        designOptionId: z.string().uuid(),
        products: z
          .array(
            z.object({
              vendorName: z.string().describe("The real seller/store name, e.g. 'Pepperfry', 'Urban Ladder'."),
              productName: z.string().describe("The real product/listing title as found."),
              productUrl: z.string().nullish().describe("The real listing URL, if the search returned one."),
              price: z.number().nullish().describe("The real listed price in INR, if known."),
              notes: z.string().nullish().describe("Any relevant detail, e.g. why this was chosen over an alternative."),
            })
          )
          .min(1),
      },
    },
    async (raw) => {
      try {
        const { projectId, designOptionId, products } = stripNulls(raw);
        return textResult(await recordSourcedProducts(supabase, projectId, { designOptionId, products }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "calculateBudgetScenarios",
    {
      description: "A pure, deterministic budget calculation over real budget_lines rows and the project's own ceiling — never an LLM guess at a price. Writes nothing; returns the calculation only.",
      inputSchema: {
        ...projectIdSchema,
        contingencyPercent: z.number().nullish().describe("Defaults to 10."),
        categoryEstimates: z
          .array(z.object({ category: z.string(), estimated: z.number() }))
          .nullish()
          .describe("Hypothetical category estimates for this one calculation — not persisted."),
      },
    },
    async (raw) => {
      try {
        const { projectId, contingencyPercent, categoryEstimates } = stripNulls(raw);
        return textResult(
          await calculateBudgetScenarios(supabase, projectId, { contingencyPercent, categoryEstimates })
        );
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordExperienceFeedbackV2",
    {
      description: "Persist classified human feedback, rejection, and any resulting decision as new evidence — feedback must already be classified by the calling agent, not raw text.",
      inputSchema: {
        ...projectIdSchema,
        designOptionId: z.string().uuid().nullish().describe("Required together with sentiment if this feedback is about a specific design option."),
        sentiment: sentimentEnum.nullish(),
        comment: z.string().nullish(),
        subElement: z.string().nullish().describe("e.g. layout, materials, colour, storage, lighting, cost."),
        evidence: z
          .array(
            z.object({
              domain: domainEnum,
              evidenceType: evidenceTypeEnum,
              statement: z.string(),
              status: evidenceStatusEnum.nullish(),
              confidence: confidenceEnum.nullish(),
            })
          )
          .nullish()
          .describe("Newly classified evidence this feedback produced — changed preferences, rejections, etc."),
        decision: z
          .object({
            decisionText: z.string(),
            decisionMakerRole: decisionMakerRoleEnum.nullish(),
            alternativesConsidered: z.array(z.string()).nullish(),
            rationale: z.string().nullish(),
            affectedDomains: z.array(domainEnum).nullish(),
            reversibility: z.string().nullish(),
          })
          .nullish()
          .describe("Present only if this feedback resulted in a recorded decision."),
      },
    },
    async (raw) => {
      try {
        const { projectId, ...input } = stripNulls(raw);
        return textResult(await recordExperienceFeedback(supabase, projectId, input));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "applyDependencyImpactPatch",
    {
      description: "Propagate a change across dependent design options, decisions, readiness, and questions while preserving history — the Impact & Change Propagation Agent's one adapter for a ripple effect.",
      inputSchema: {
        ...projectIdSchema,
        summary: z.string().nullish().describe("Human-readable summary of what changed and why, logged as the project's activity entry."),
        invalidatedDesignOptionIds: z.array(z.string().uuid()).nullish().describe("design_options to mark rejected as a result of this change."),
        supersededDecisions: z
          .array(
            z.object({
              oldDecisionId: z.string().uuid().describe("The decision being superseded — marked superseded, not deleted."),
              newDecisionText: z.string(),
              decisionMakerRole: decisionMakerRoleEnum.nullish(),
              rationale: z.string().nullish(),
              affectedDomains: z.array(domainEnum).nullish(),
            })
          )
          .nullish(),
        readinessUpdates: z
          .array(z.object({ domain: domainEnum, state: readinessStateEnum, reason: z.string().nullish() }))
          .nullish(),
        newQuestions: z
          .array(
            z.object({
              domain: domainEnum,
              questionText: z.string(),
              whyItMatters: z.string().nullish(),
              severity: severityEnum.nullish(),
            })
          )
          .nullish(),
      },
    },
    async (raw) => {
      try {
        const { projectId, ...input } = stripNulls(raw);
        return textResult(await applyDependencyImpactPatch(supabase, projectId, input));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "generateRoleHandoffBrief",
    {
      description: "Store a role-appropriate handoff brief the agent has composed, for human review and approval before any delivery — never claim approval, verification, or legal permission on the project's behalf.",
      inputSchema: {
        ...projectIdSchema,
        recipientRole: z.string().nullish().describe('Who this brief is written for, e.g. professional, contractor, architect. Defaults to "professional".'),
        briefText: z
          .string()
          .describe(
            "The full composed brief — context, approved decisions, recommendations, unresolved questions, evidence and provenance, assumptions, risks, dependencies, budget implications, verification requirements, and next actions with owners."
          ),
      },
    },
    async (raw) => {
      try {
        const { projectId, recipientRole, briefText } = stripNulls(raw);
        return textResult(await generateRoleHandoffBrief(supabase, projectId, { recipientRole, briefText }));
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  return server;
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
