import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain } from "@/lib/types/domain";
import { ToolError } from "./errors";
import { fetchAndStoreImage } from "./fetch-and-store-image";

export interface RecordEngineArtifactInput {
  engine: Domain;
  artifactType: string;
  content?: string;
  imageUrl?: string;
}

// Shared logic behind recordEngineArtifact — a Step 2 domain agent's rich,
// composed output (Family's persona, Spatial's floor-plan image, Budget's
// P&L breakdown, Constraint's summary), written as a new row every time
// rather than updated in place, same append-only pattern as evidence.
// Exactly one of content (rendered as static HTML) or imageUrl (a Yoxa
// Output Tool: Image result, re-hosted in our own storage — see
// fetch-and-store-image.ts) is expected per call; Preference's moodboard
// uses record-preference-moodboard-images.ts instead, since it needs many
// independently-reactable images rather than one artifact. See
// get-canonical-renovation-dna.ts for why this lives separately from the
// route handlers that call it.
export async function recordEngineArtifact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordEngineArtifactInput
) {
  const hasContent = Boolean(input.content && input.content.trim().length > 0);
  const hasImage = Boolean(input.imageUrl);
  if (hasContent === hasImage) {
    throw new ToolError(400, "Provide exactly one of content or imageUrl");
  }

  let imageStoragePath: string | null = null;
  if (hasImage) {
    const stored = await fetchAndStoreImage(supabase, "project-attachments", `${projectId}/artifacts/`, input.imageUrl!);
    imageStoragePath = stored.storagePath;
  }

  const { data, error } = await supabase
    .from("project_artifacts")
    .insert({
      project_id: projectId,
      engine: input.engine,
      artifact_type: input.artifactType,
      content: hasContent ? input.content : null,
      image_storage_path: imageStoragePath,
    })
    .select()
    .single();

  if (error) throw new ToolError(500, error.message);

  return { artifact: data };
}
