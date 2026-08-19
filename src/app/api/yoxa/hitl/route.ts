import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/types/database";

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function verifySignature(rawBody: string, timestamp: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const match = signatureHeader.match(/^v1=([0-9a-f]+)$/i);
  if (!match) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(match[1], "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

// POST /api/yoxa/hitl
// Receives Yoxa's signed human_approval webhook (Human Review Checkpoint /
// Human Decision Checkpoint). Yoxa -> here -> persisted -> shown in our
// UI -> a human decides -> a separate authenticated route POSTs the
// decision back to Yoxa. See references/deployed-hitl-integration.md in
// the deployment-helper skill for the full contract this implements.
export async function POST(request: NextRequest) {
  const signingSecret = process.env.YOXA_HITL_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "YOXA_HITL_WEBHOOK_SIGNING_SECRET not configured" }, { status: 503 });
  }

  // Raw bytes must be read before any JSON parsing — the signature is
  // computed over the exact request body string, not a reserialized copy.
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-yoxa-webhook-timestamp");
  const signature = request.headers.get("x-yoxa-webhook-signature");

  if (!timestamp) {
    return NextResponse.json({ error: "Missing X-Yoxa-Webhook-Timestamp" }, { status: 400 });
  }

  if (!verifySignature(rawBody, timestamp, signature, signingSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventTime = new Date(timestamp).getTime();
  if (Number.isNaN(eventTime) || Math.abs(Date.now() - eventTime) > MAX_TIMESTAMP_SKEW_MS) {
    return NextResponse.json({ error: "Stale timestamp" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = payload.event_type as string | undefined;
  const eventId = payload.event_id as string | undefined;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id" }, { status: 400 });
  }

  if (eventType === "hitl.webhook_test") {
    console.log(`[yoxa.hitl] verified test event ${eventId}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (eventType !== "hitl.approval_requested") {
    // Unknown event type — acknowledge so Yoxa doesn't retry indefinitely,
    // but don't pretend we processed something we don't understand.
    console.warn(`[yoxa.hitl] unrecognized event_type: ${eventType}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const workflowRunId = payload.workflow_run_id as string | undefined;
  const yoxaRequestId = payload.request_id as string | undefined;
  const title = payload.title as string | undefined;
  if (!workflowRunId || !yoxaRequestId || !title) {
    return NextResponse.json({ error: "Missing required approval fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: run } = await supabase
    .from("workflow_runs")
    .select("project_id")
    .eq("workflow_run_id", workflowRunId)
    .maybeSingle();

  if (!run) {
    // We have no record of triggering this run — can't route it to a
    // project. Acknowledge receipt (it's not retryable-useful) but flag it.
    console.error(`[yoxa.hitl] unknown workflow_run_id: ${workflowRunId}`);
    return NextResponse.json({ error: "Unknown workflow_run_id" }, { status: 200 });
  }

  const { error } = await supabase.from("yoxa_hitl_requests").insert({
    event_id: eventId,
    workflow_run_id: workflowRunId,
    project_id: run.project_id,
    yoxa_request_id: yoxaRequestId,
    title,
    description: (payload.description as string | undefined) ?? null,
    options: (payload.options as Json) ?? [],
  });

  if (error) {
    // Unique violation on event_id means this is a redelivery of an event
    // we already persisted — that's success, not an error, per Yoxa's
    // at-least-once delivery semantics.
    if (error.code === "23505") {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("events").insert({
    project_id: run.project_id,
    event_type: "hitl_approval_requested",
    payload: { workflow_run_id: workflowRunId, yoxa_request_id: yoxaRequestId },
    activity_summary: `Renovagent needs a decision: ${title}`,
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
