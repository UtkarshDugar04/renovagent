// App → Yoxa trigger call. One workflow deployment serves every project,
// and the trigger payload has exactly two fields (trigger_text, file) —
// no project_id field exists, so it's embedded as a parseable header line
// at the start of trigger_text. The Conversation Agent's instruction in
// Yoxa must read that line and use it for every tool call in the run;
// see the RENOVAGENT_CONTEXT format below.
//
// Fire-and-forget from the caller's perspective: Yoxa runs asynchronously
// and there is no response webhook (confirmed in Release → Integrate —
// Human Approvals are Yoxa-managed and there's no callback/webhook
// setting anywhere in that checklist). Everything the workflow produces
// comes back through the /api/yoxa/** tool calls it makes into this app
// while it runs, not through this trigger call's response.

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
  rawBody: string;
}

export async function triggerYoxaWorkflow(input: TriggerYoxaInput): Promise<TriggerYoxaResult> {
  const triggerUrl = process.env.YOXA_TRIGGER_URL;
  const secret = process.env.YOXA_DEPLOYMENT_SECRET;

  if (!triggerUrl || !secret) {
    return { ok: false, statusCode: 0, workflowRunId: null, rawBody: "YOXA_TRIGGER_URL or YOXA_DEPLOYMENT_SECRET not configured" };
  }

  const triggerText = `[RENOVAGENT_CONTEXT project_id=${input.projectId} sender_role=${input.senderRole}]\n${input.messageText}`;

  const form = new FormData();
  form.append("trigger_text", triggerText);

  if (input.attachment) {
    form.append("file", input.attachment.content, input.attachment.filename);
  } else {
    form.append("file", new Blob(["(no attachment)"], { type: "text/plain" }), "no-attachment.txt");
  }

  const idempotencyKey = crypto.randomUUID();

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

  return { ok: response.ok, statusCode: response.status, workflowRunId, rawBody };
}
