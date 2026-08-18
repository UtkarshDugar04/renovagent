import { NextRequest, NextResponse } from "next/server";

// Every route under src/app/api/yoxa/** is called by Yoxa itself, not a
// logged-in browser — there's no Supabase session to check. Guard with a
// static bearer token instead (set as YOXA_INBOUND_API_KEY in env, entered
// into Yoxa's connector configuration after the OpenAPI file is uploaded —
// never written into the YAML itself).
export function requireYoxaAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.YOXA_INBOUND_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "YOXA_INBOUND_API_KEY is not configured on this deployment" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
