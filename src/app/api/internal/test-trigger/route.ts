import { NextRequest, NextResponse } from "next/server";
import { triggerYoxaWorkflow } from "@/lib/yoxa/trigger";

// Temporary diagnostic route: fires a real Yoxa trigger call from this
// Vercel deployment itself (not a local machine), to rule out an
// origin/network-level rejection versus a credential/payload problem.
// Protected by the same bearer key Yoxa's own inbound calls use, since
// this is a real side-effecting action. Delete once the activation issue
// is resolved.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.YOXA_INBOUND_API_KEY}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const result = await triggerYoxaWorkflow({
    projectId,
    senderRole: "agency",
    messageText: "Diagnostic trigger fired from the Vercel deployment itself.",
  });

  return NextResponse.json(result);
}
