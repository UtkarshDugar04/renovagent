import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getProjectRole } from "@/lib/auth/project-access";

// POST /api/projects/:projectId/hitl/:hitlRequestId/respond
// Called by our own authenticated UI once a human picks an option (or
// writes an override). Verifies the caller is a project member, then
// sends the decision to Yoxa's response endpoint with the response
// secret — this is the client->Yoxa half of the HITL contract; the
// webhook route (src/app/api/yoxa/hitl/route.ts) is the Yoxa->client half.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; hitlRequestId: string }> }
) {
  const { projectId, hitlRequestId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return NextResponse.json({ error: "Not a member of this project" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const selectedOptionId: string | undefined = body?.selectedOptionId;
  const overrideMessage: string | undefined = body?.overrideMessage;
  if (!selectedOptionId && !overrideMessage) {
    return NextResponse.json({ error: "selectedOptionId or overrideMessage is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: hitlRequest } = await service
    .from("yoxa_hitl_requests")
    .select("*")
    .eq("id", hitlRequestId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!hitlRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (hitlRequest.status === "answered") {
    return NextResponse.json({ error: "This request has already been answered" }, { status: 409 });
  }

  const triggerUrl = process.env.YOXA_TRIGGER_URL;
  const responseSecret = process.env.YOXA_HITL_RESPONSE_SECRET;
  if (!triggerUrl || !responseSecret) {
    return NextResponse.json({ error: "HITL response is not configured on this deployment" }, { status: 503 });
  }

  const parsedTriggerUrl = new URL(triggerUrl);
  const deploymentMatch = parsedTriggerUrl.pathname.match(/\/workflow-deployments\/([^/]+)\//);
  const deploymentId = deploymentMatch?.[1];
  if (!deploymentId) {
    return NextResponse.json({ error: "Could not derive deployment id from YOXA_TRIGGER_URL" }, { status: 500 });
  }

  const respondUrl = `${parsedTriggerUrl.origin}/api/v1/public/workflow-deployments/${deploymentId}/hitl/requests/${hitlRequest.yoxa_request_id}/respond`;

  const yoxaResponse = await fetch(respondUrl, {
    method: "POST",
    headers: {
      "X-Yoxa-HITL-Response-Secret": responseSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      selectedOptionId ? { selected_option_id: selectedOptionId } : { override_message: overrideMessage }
    ),
  });

  if (yoxaResponse.status !== 202 && yoxaResponse.status !== 200) {
    const text = await yoxaResponse.text();
    return NextResponse.json({ error: `Yoxa rejected the response: ${text}` }, { status: 502 });
  }

  await service
    .from("yoxa_hitl_requests")
    .update({
      status: "answered",
      selected_option_id: selectedOptionId ?? null,
      override_message: overrideMessage ?? null,
      answered_by: user.id,
      answered_at: new Date().toISOString(),
    })
    .eq("id", hitlRequestId);

  await service.from("events").insert({
    project_id: projectId,
    event_type: "hitl_answered",
    activity_summary: `A decision was submitted: ${hitlRequest.title}`,
  });

  return NextResponse.json({ ok: true });
}
