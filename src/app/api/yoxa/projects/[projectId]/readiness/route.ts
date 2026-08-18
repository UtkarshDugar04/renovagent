import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import type { Domain, ReadinessState } from "@/lib/types/domain";

interface ReadinessInput {
  domain: Domain;
  state: ReadinessState;
  reason?: string;
}

// POST /api/yoxa/projects/:projectId/readiness
// Backs `record_readiness_assessment`. This is the real Validation and
// Readiness Agent's gate decision overriding our internal rule-based
// stub (src/lib/yoxa/recompute-readiness.ts) for whichever domains it
// assesses — once Yoxa is live, this becomes the authoritative source for
// those domains; the stub still covers any domain Yoxa hasn't assessed
// yet.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const assessments: ReadinessInput[] = Array.isArray(body?.assessments) ? body.assessments : [];
  if (assessments.length === 0) {
    return NextResponse.json({ error: "At least one readiness assessment is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("readiness")
    .upsert(
      assessments.map((a) => ({
        project_id: projectId,
        domain: a.domain,
        state: a.state,
        reason: a.reason ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,domain" }
    )
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "readiness_assessed",
    payload: { domains: assessments.map((a) => a.domain), source: "yoxa" },
    activity_summary: `Renovagent assessed readiness for ${assessments.map((a) => a.domain).join(", ")}.`,
  });

  return NextResponse.json({ readiness: data ?? [] });
}
