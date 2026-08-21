import Groq from "groq-sdk";

// Thin factory, same shape as src/lib/gemini/client.ts — every Groq call
// site builds its own client from this rather than constructing Groq
// inline, so the API key check happens in exactly one place.
export function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return new Groq({ apiKey });
}

// Real-time conversational turns (processTurn) — latency-sensitive, called
// once per message/transcript fragment during a live call.
export const CONVERSATION_MODEL = "openai/gpt-oss-20b";

// Once-per-project brief generation — quality-sensitive, low call volume.
export const ANALYSIS_MODEL = "openai/gpt-oss-120b";

export async function generateWithRetry<T>(call: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status !== 503 && status !== 429 && status !== 500) throw err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  throw lastErr;
}
