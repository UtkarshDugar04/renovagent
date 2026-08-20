import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  calculateBudgetScenarios,
  type CalculateBudgetScenariosInput,
} from "@/lib/yoxa/tools/calculate-budget-scenarios";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/budget-scenarios
// Backs `calculate_budget_scenarios` from the Sourcing Agent.
//
// The actual logic lives in
// src/lib/yoxa/tools/calculate-budget-scenarios.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  // Body is optional on this endpoint (every field defaults) — a caller
  // that sends no body at all, or an empty one, must not 500.
  const body: CalculateBudgetScenariosInput = await request.json().catch(() => ({}));

  try {
    const result = await calculateBudgetScenarios(supabase, projectId, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
