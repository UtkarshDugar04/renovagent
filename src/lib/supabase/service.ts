import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Server-to-server client for calls with no browser session to attach RLS
// to (Yoxa's inbound tool calls) — bypasses RLS entirely via the service
// role key. Never expose this to the browser; only import from route
// handlers under src/app/api/yoxa/**, and only after requireYoxaAuth()
// has verified the caller.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
