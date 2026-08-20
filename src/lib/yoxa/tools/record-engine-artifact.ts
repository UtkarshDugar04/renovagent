import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain } from "@/lib/types/domain";
import { ToolError } from "./errors";

export interface RecordEngineArtifactInput {
  engine: Domain;
  artifactType: string;
  content: string;
}

// Shared logic behind recordEngineArtifact — a Step 2 domain agent's rich,
// composed output (Preference's moodboard, Family's persona, Spatial's rough
// schematic, Constraint's summary), written as a new row every time rather
// than updated in place, same append-only pattern as evidence. See
// get-canonical-renovation-dna.ts for why this lives separately from the
// route handlers that call it.
export async function recordEngineArtifact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordEngineArtifactInput
) {
  if (!input.content || input.content.trim().length === 0) {
    throw new ToolError(400, "content is required");
  }

  const { data, error } = await supabase
    .from("project_artifacts")
    .insert({
      project_id: projectId,
      engine: input.engine,
      artifact_type: input.artifactType,
      content: input.content,
    })
    .select()
    .single();

  if (error) throw new ToolError(500, error.message);

  return { artifact: data };
}
