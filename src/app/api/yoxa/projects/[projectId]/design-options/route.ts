import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  recordProposedDesignPackage,
  type RecordProposedDesignPackageInput,
} from "@/lib/yoxa/tools/record-proposed-design-package";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/design-options
// Backs `record_proposed_design_package` from the Design Agent.
//
// The actual logic lives in
// src/lib/yoxa/tools/record-proposed-design-package.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: RecordProposedDesignPackageInput = await request.json();

  try {
    const result = await recordProposedDesignPackage(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
