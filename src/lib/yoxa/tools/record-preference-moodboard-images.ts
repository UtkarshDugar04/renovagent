import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";
import { fetchAndStoreImage } from "./fetch-and-store-image";

export interface PreferenceMoodboardImageInput {
  imageUrl: string;
  caption?: string;
  roomOrTheme?: string;
}

export interface RecordPreferenceMoodboardImagesInput {
  images: PreferenceMoodboardImageInput[];
}

// Shared logic behind recordPreferenceMoodboardImages — the Preference
// Intelligence Agent's moodboard, one row per real generated image (a
// Yoxa Output Tool: Image result, re-hosted in our own storage — see
// fetch-and-store-image.ts). Unlike recordEngineArtifact's append-only
// single-document-per-run shape, the moodboard accumulates images across
// runs and each image is independently reactable (thumbs up/down/save via
// /api/projects/:projectId/preference-images/:imageId/react), so it lives
// in its own table rather than project_artifacts.
export async function recordPreferenceMoodboardImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordPreferenceMoodboardImagesInput
) {
  const images = input.images ?? [];
  if (images.length === 0) {
    throw new ToolError(400, "At least one image is required");
  }

  const rows = [];
  for (const image of images) {
    const stored = await fetchAndStoreImage(supabase, "project-attachments", `${projectId}/preference-images/`, image.imageUrl);
    rows.push({
      project_id: projectId,
      storage_path: stored.storagePath,
      caption: image.caption ?? null,
      room_or_theme: image.roomOrTheme ?? null,
    });
  }

  const { data: inserted, error } = await supabase.from("preference_images").insert(rows).select();
  if (error) throw new ToolError(500, error.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "preference_moodboard_images_added",
    payload: { image_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent added ${inserted?.length ?? 0} image(s) to the preference moodboard.`,
  });

  return { images: inserted ?? [] };
}
