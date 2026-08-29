// App → Yoxa trigger call. One workflow deployment serves every project,
// and the trigger payload has exactly two fields (trigger_text, file) —
// no project_id field exists, so it's embedded as a parseable header line
// at the start of trigger_text. The Conversation Agent's instruction in
// Yoxa must read that line and use it for every tool call in the run;
// see the RENOVAGENT_CONTEXT format below.
//
// Fire-and-forget from the caller's perspective: this call's response only
// confirms Yoxa accepted the run (or didn't) — it does not carry the run's
// output. Everything the workflow produces comes back through the
// /api/yoxa/** tool calls it makes into this app while it runs, plus the
// deployed HITL webhook (/api/yoxa/hitl) for anything needing a human
// decision. The caller is responsible for writing the returned
// workflowRunId into `workflow_runs` — see send-to-yoxa.ts — since that's
// what lets the HITL webhook resolve an incoming run back to its project.

export interface TriggerYoxaAttachment {
  filename: string;
  content: Blob;
}

export interface TriggerYoxaInput {
  projectId: string;
  senderRole: string;
  messageText: string;
  // The public trigger endpoint requires a `file` field on every request
  // (confirmed: "file is required", and there's no config toggle to make
  // it optional). Pass the real attachment when the message has one;
  // otherwise a placeholder is sent so text-only messages still work.
  attachment?: TriggerYoxaAttachment;
}

export interface TriggerYoxaResult {
  ok: boolean;
  statusCode: number;
  workflowRunId: string | null;
  deploymentId: string | null;
  rawBody: string;
}

// Shared with the HITL respond route, which must answer a request against
// the same deployment its run was triggered under — not whichever
// deployment YOXA_TRIGGER_URL currently points to. See
// 20260830000000_workflow_runs_deployment_id.sql for why that distinction
// matters.
export function deriveDeploymentIdFromTriggerUrl(triggerUrl: string): string | null {
  try {
    const parsed = new URL(triggerUrl);
    const match = parsed.pathname.match(/\/workflow-deployments\/([^/]+)\//);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function triggerYoxaWorkflow(input: TriggerYoxaInput): Promise<TriggerYoxaResult> {
  const triggerUrl = process.env.YOXA_TRIGGER_URL;
  const secret = process.env.YOXA_DEPLOYMENT_SECRET;

  if (!triggerUrl || !secret) {
    return { ok: false, statusCode: 0, workflowRunId: null, deploymentId: null, rawBody: "YOXA_TRIGGER_URL or YOXA_DEPLOYMENT_SECRET not configured" };
  }

  const triggerText = `[RENOVAGENT_CONTEXT project_id=${input.projectId} sender_role=${input.senderRole}]\n${input.messageText}`;

  const form = new FormData();
  form.append("trigger_text", triggerText);

  if (input.attachment) {
    form.append("file", input.attachment.content, input.attachment.filename);
  } else {
    form.append("file", new Blob(["(no attachment)"], { type: "text/plain" }), "no-attachment.txt");
  }

  // Stable per project, not a fresh UUID per call: a project fires this
  // trigger at most once by design, so reusing projectId (already a valid
  // UUID) as the idempotency key means a retry after an ambiguous network
  // failure (request sent, response lost) can't cause a real double-run at
  // Yoxa's end — a fresh key per attempt would defeat the whole point of
  // the header.
  const idempotencyKey = input.projectId;

  const response = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      "X-Yoxa-Deployment-Secret": secret,
      "Idempotency-Key": idempotencyKey,
    },
    body: form,
  });

  const rawBody = await response.text();
  let workflowRunId: string | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    workflowRunId = parsed?.workflow_run_id ?? parsed?.run_id ?? parsed?.id ?? null;
  } catch {
    // Non-JSON response — leave workflowRunId null, caller sees rawBody.
  }

  return {
    ok: response.ok,
    statusCode: response.status,
    workflowRunId,
    deploymentId: deriveDeploymentIdFromTriggerUrl(triggerUrl),
    rawBody,
  };
}
