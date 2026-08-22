// Turns a project's full conversation history into the end-of-call
// markdown brief — the ONLY thing the Yoxa trigger carries, and the only
// conversational evidence a project will ever have (per the Yoxa workflow
// context doc: no live back-and-forth with Planning during the call, no
// second submission window after this fires). Sections match that doc's
// spec exactly: Household & Scope, Family Intelligence, Preference
// Intelligence (verbal only), Budget Intelligence, Constraint Intelligence
// (verbal only — spatial evidence only ever comes from document upload
// processing, never this brief), Conflicts/Disagreements, Open Questions,
// Agent Notes.
//
// Runs on Groq (text-only summarization, no vision needed) rather than
// Gemini — see process-turn.ts for why.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createGroqClient, generateWithRetry, ANALYSIS_MODEL } from "@/lib/groq/client";

export interface GenerateBriefResult {
  markdown: string;
  messageCount: number;
}

const SYSTEM_INSTRUCTION = `You write the end-of-call intake brief for a home renovation project, from a full conversation transcript between a homeowner, their renovation agency, and Renovagent's own live assistant (sender "admin").

Produce ONLY the brief as markdown, with exactly these top-level headings, in this order:

## Household & Scope
## Family Intelligence
## Preference Intelligence
## Budget Intelligence
## Constraint Intelligence
## Conflicts / Disagreements
## Open Questions
## Agent Notes

Rules:
- Preference Intelligence and Constraint Intelligence are VERBAL ONLY — capture only what was actually said in this conversation. Never invent spatial measurements, room layouts, or anything that would need a photo/floor plan to know; that comes from a separate document-processing pipeline, not this call.
- Every statement must trace to something a participant (homeowner or agency) actually said. The "admin" sender is Renovagent's own assistant asking questions during the call — treat its lines as conversational context only, never as a source of evidence.
- "Conflicts / Disagreements" — only include if the homeowner and agency actually said contradictory things; omit the section's content (just "None noted.") if there weren't any.
- "Open Questions" — things that came up but were never actually answered in this conversation.
- "Agent Notes" — brief, useful context for the agents who read this next: tone of the conversation, anything ambiguous, anything that seemed rushed or uncertain.
- Be concise and information-dense — this file has a hard 15-page limit. Do not pad with generic renovation advice or restate the same fact twice. If a section has nothing, write "None noted." rather than omitting the heading.
- Never fabricate. If something wasn't said, it doesn't go in the brief.
- Respond with the markdown brief only — no commentary, no code fences, no preamble.`;

const CHUNK_SUMMARY_SYSTEM = `You are compressing one segment of a longer home renovation intake conversation transcript into dense factual notes, to be combined with notes from other segments later into a final structured brief. Extract every concrete fact stated by the homeowner or agency — household composition, routines, preferences, budget figures, constraints, disagreements — as short factual bullet points, one per fact. Do not write vague summary prose and do not drop specifics. Ignore lines from sender "admin" except as context for what question was being answered. Output only the bullet points, nothing else.`;

// Groq's org-wide rate limit for ANALYSIS_MODEL is small enough (confirmed
// live: 8000 TPM, shared across the whole org) that a single long,
// substantive conversation — exactly what a real intake call should be —
// can blow past it in one request. Rather than cap conversation length,
// chunk the transcript and compress each piece into dense factual notes
// first, then synthesize the final brief from the combined notes instead
// of the raw transcript. Scales to arbitrarily long conversations.
const MAX_TRANSCRIPT_CHARS_PER_CALL = 12000; // ~3000 tokens by the ~4-chars-per-token rule of thumb, leaving real headroom under the 8000 TPM cap alongside the system instruction and the completion's own token reservation

function chunkTranscriptLines(lines: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const line of lines) {
    if (currentLen + line.length > maxChars && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [];
      currentLen = 0;
    }
    current.push(line);
    currentLen += line.length + 1;
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks;
}

export async function generateConversationBrief(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string
): Promise<GenerateBriefResult> {
  const { data: messages, error } = await supabase
    .from("conversation_messages")
    .select("sender_role, text, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!messages || messages.length === 0) {
    throw new Error("No conversation to summarize — nothing has been said in this project yet");
  }

  const lines = messages
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m) => `[${m.sender_role}]: ${m.text}`);
  const fullTranscript = lines.join("\n");

  const groq = createGroqClient();
  let sourceText = fullTranscript;

  if (fullTranscript.length > MAX_TRANSCRIPT_CHARS_PER_CALL) {
    const chunks = chunkTranscriptLines(lines, MAX_TRANSCRIPT_CHARS_PER_CALL);
    const digests: string[] = [];
    // Sequential, not parallel — the rate limit is shared per-minute
    // across the whole org, so firing these concurrently risks the exact
    // 413 this chunking exists to avoid.
    for (const chunk of chunks) {
      const chunkResult = await generateWithRetry(() =>
        groq.chat.completions.create({
          model: ANALYSIS_MODEL,
          messages: [
            { role: "system", content: CHUNK_SUMMARY_SYSTEM },
            { role: "user", content: chunk },
          ],
          max_tokens: 1200,
        })
      );
      const digest = chunkResult.choices[0]?.message?.content?.trim();
      if (digest) digests.push(digest);
    }
    sourceText = digests.join("\n\n");
  }

  const promptLabel =
    sourceText === fullTranscript
      ? "Full conversation transcript (chronological)"
      : "Chronological factual notes extracted from the full transcript, segment by segment";

  const result = await generateWithRetry(() =>
    groq.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `${promptLabel}:\n\n${sourceText}` },
      ],
      max_tokens: 3000,
    })
  );

  const markdown = result.choices[0]?.message?.content?.trim();
  if (!markdown) throw new Error("Groq returned an empty brief");

  return { markdown, messageCount: messages.length };
}
