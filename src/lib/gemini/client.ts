import { GoogleGenAI } from "@google/genai";

// Thin factory, mirroring src/lib/supabase/service.ts — every Gemini call
// site builds its own client from this rather than constructing GoogleGenAI
// inline, so the API key check happens in exactly one place.
export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

// Pro-tier models report zero free-tier quota on this key (confirmed via a
// live 429 with limit:0), so everything runs on flash. "-latest" aliases
// track Google's current recommended model rather than a pinned version
// that can be deprecated out from under this code (confirmed this session:
// gemini-2.5-flash itself already 404s as "no longer available to new
// users"). Quality gap versus pro is compensated for with more explicit,
// structured system instructions at each call site, not a bigger model.
export const CONVERSATION_MODEL = "gemini-flash-latest";

// Once-per-project brief generation and attachment vision/document
// understanding — same tier as conversation (no pro quota available), but
// lower call volume, so worth the same model with a much more thorough
// system instruction per call site.
export const ANALYSIS_MODEL = "gemini-flash-latest";

// The free tier returns transient 503 "high demand" errors under real
// load (confirmed repeatedly this session — same request succeeds on a
// retry seconds later, no code or quota problem). Every Gemini call site
// should go through this rather than calling generateContent directly.
export async function generateWithRetry<T>(
  call: () => Promise<T>,
  attempts = 5
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status !== 503 && status !== 429) throw err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
      }
    }
  }
  throw lastErr;
}
