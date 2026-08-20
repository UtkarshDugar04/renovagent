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

import type { SupabaseClient } from "@supabase/supabase-js";
import { createGeminiClient, generateWithRetry, ANALYSIS_MODEL } from "@/lib/gemini/client";

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
- Never fabricate. If something wasn't said, it doesn't go in the brief.`;

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

  const transcript = messages
    .filter((m) => m.text && m.text.trim().length > 0)
    .map((m) => `[${m.sender_role}]: ${m.text}`)
    .join("\n");

  const ai = createGeminiClient();
  const result = await generateWithRetry(() =>
    ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: `Full conversation transcript (chronological):\n\n${transcript}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 6000,
      },
    })
  );

  const markdown = result.text?.trim();
  if (!markdown) throw new Error("Gemini returned an empty brief");

  return { markdown, messageCount: messages.length };
}
