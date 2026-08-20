import { NextRequest } from "next/server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { getCanonicalRenovationDna } from "@/lib/yoxa/tools/get-canonical-renovation-dna";
import { reviewSpatialEvidence } from "@/lib/yoxa/tools/review-spatial-evidence";
import {
  updateCanonicalRenovationDna,
  type UpdateCanonicalRenovationDnaInput,
} from "@/lib/yoxa/tools/update-canonical-renovation-dna";
import { recordEngineArtifact } from "@/lib/yoxa/tools/record-engine-artifact";
import { recordPendingOrchestrationState } from "@/lib/yoxa/tools/record-pending-orchestration-state";
import { recordReadinessAssessment } from "@/lib/yoxa/tools/record-readiness-assessment";
import { recordProposedDesignPackage } from "@/lib/yoxa/tools/record-proposed-design-package";
import { calculateBudgetScenarios } from "@/lib/yoxa/tools/calculate-budget-scenarios";
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

const projectIdSchema = { projectId: z.string().uuid().describe("The project's id, exactly as provided in the call context — never guessed.") };

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function buildServer() {
  const server = new McpServer({ name: "renovagent", version: "1.0.0" });
  const supabase = createServiceClient();

  server.registerTool(
    "getCanonicalRenovationDna",
    {
      description: "Read the full canonical Renovation DNA for one project — household, evidence, questions, assumptions, decisions, trade-offs, conflicts, readiness, constraints, budget lines, spatial elements.",
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

  server.registerTool(
    "updateCanonicalRenovationDna",
    {
      description: "Apply a provenance-aware evidence patch to a project's Renovation DNA — new evidence, questions, conflicts, household members, constraints, budget lines, and spatial elements.",
      inputSchema: {
        ...projectIdSchema,
        evidence: z
          .array(
            z.object({
              domain: domainEnum,
              evidenceType: evidenceTypeEnum,
              statement: z.string(),
              status: evidenceStatusEnum.optional(),
              confidence: confidenceEnum.optional(),
              authority: authorityEnum.optional(),
              source: z.string().optional(),
              contradictsEvidenceId: z.string().uuid().optional(),
              supersededById: z.string().uuid().optional(),
            })
          )
          .min(1)
          .describe("New evidence to add, each carrying its own canonical classification."),
        newQuestions: z
          .array(
            z.object({
              domain: domainEnum,
              questionText: z.string(),
              whyItMatters: z.string().optional(),
              severity: severityEnum.optional(),
              blocksReadiness: z.boolean().optional(),
            })
          )
          .optional(),
        conflicts: z
          .array(
            z.object({
              evidenceAId: z.string().uuid(),
              evidenceBId: z.string().uuid(),
              reason: z.string(),
              affectedDomains: z.array(domainEnum).optional(),
            })
          )
          .optional(),
        householdMembers: z
          .array(
            z.object({
              name: z.string(),
              roleInHousehold: z.string().optional(),
              isPrimaryContact: z.boolean().optional(),
              accessibilityNeeds: z.string().optional(),
            })
          )
          .optional()
          .describe("Only ever sourced from conversational evidence — never inferred from documents."),
        constraints: z
          .array(
            z.object({
              category: z.string(),
              hardness: hardnessEnum,
              status: constraintStatusEnum.optional(),
              description: z.string(),
              evidenceIds: z.array(z.string().uuid()).optional(),
            })
          )
          .optional(),
        budgetLines: z
          .array(
            z.object({
              category: z.string(),
              probableLow: z.number().optional(),
              probableHigh: z.number().optional(),
              estimated: z.number().optional(),
              quoted: z.number().optional(),
              confirmed: z.number().optional(),
              priorityTier: z.string().optional(),
            })
          )
          .optional(),
        spatialElements: z
          .array(
            z.object({
              room: z.string().optional(),
              elementType: z.string(),
              attributes: z.record(z.string(), z.unknown()).optional(),
              certainty: confidenceEnum,
              requiresVerification: z.boolean().optional(),
              evidenceIds: z.array(z.string().uuid()).optional(),
            })
          )
          .optional(),
      },
    },
    async ({ projectId, ...input }) => {
      try {
        return textResult(
          await updateCanonicalRenovationDna(
            supabase,
            projectId,
            input as UpdateCanonicalRenovationDnaInput
          )
        );
      } catch (err) {
        return errorResult(err instanceof ToolError ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "recordEngineArtifact",
    {
      description: "Store a domain intelligence engine's composed output — a moodboard, a persona document, a rough schematic, a constraint summary — rendered on Renovagent's own dashboard, not Yoxa's interface. Rendered inside a fully sandboxed iframe, so scripts never execute regardless of content.",
      inputSchema: {
        ...projectIdSchema,
        engine: domainEnum,
        artifactType: z.string().describe("e.g. persona, moodboard, schematic, summary."),
        content: z.string().describe("The composed HTML content itself."),
      },
    },
    async ({ projectId, engine, artifactType, content }) => {
      try {
        return textResult(
          await recordEngineArtifact(supabase, projectId, { engine, artifactType, content })
        );
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
              owner: z.string().optional().describe("Who owns this action, e.g. a household member or professional role."),
              dueContext: z.string().optional().describe("Free-text timing context, not a hard deadline."),
            })
          )
          .optional(),
        escalationLevel: severityEnum.optional(),
      },
    },
    async ({ projectId, summary, pendingActions, escalationLevel }) => {
      try {
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
              reason: z.string().optional().describe("Free-text explanation, blockers, and accepted uncertainty for this domain's gate decision."),
            })
          )
          .min(1),
      },
    },
    async ({ projectId, assessments }) => {
      try {
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
        roundNumber: z.number().int().optional().describe("Existing or new design round number. Omit to start a new round automatically."),
        options: z
          .array(
            z.object({
              label: z.string(),
              rationale: z.string(),
              satisfiesEvidenceIds: z.array(z.string().uuid()).optional(),
              tradeOffs: z.array(z.object({ gained: z.string(), sacrificed: z.string() })).optional(),
              costBand: z
                .object({ low: z.number(), high: z.number(), confidence: confidenceEnum })
                .nullable()
                .optional(),
              sourcingStatus: z.enum(["not_evaluated", "grounded", "indicative", "ungrounded"]).optional(),
              whatItWouldFeelLike: z.string().optional(),
              visibleToHomeowner: z.boolean().optional().describe("Defaults to false — hidden from the homeowner until the agency releases it."),
            })
          )
          .min(1),
      },
    },
    async ({ projectId, roundNumber, options }) => {
      try {
        return textResult(await recordProposedDesignPackage(supabase, projectId, { roundNumber, options }));
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
        contingencyPercent: z.number().optional().describe("Defaults to 10."),
        categoryEstimates: z
          .array(z.object({ category: z.string(), estimated: z.number() }))
          .optional()
          .describe("Hypothetical category estimates for this one calculation — not persisted."),
      },
    },
    async ({ projectId, contingencyPercent, categoryEstimates }) => {
      try {
        return textResult(
          await calculateBudgetScenarios(supabase, projectId, { contingencyPercent, categoryEstimates })
        );
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
