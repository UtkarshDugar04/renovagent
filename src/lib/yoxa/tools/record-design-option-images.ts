import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";
import { fetchAndStoreImage } from "./fetch-and-store-image";

export interface DesignOptionImageInput {
  imageUrl: string;
  angle?: string;
  materialsShown?: string[];
}

export interface RecordDesignOptionImagesInput {
  designOptionId: string;
  images: DesignOptionImageInput[];
}

// Shared logic behind recordDesignOptionImages — the Design Agent's
// multi-angle visuals for one already-registered design option (see
// record-proposed-design-package.ts, which must be called first so
// designOptionId exists). A separate tool rather than a field on
// recordProposedDesignPackage: images are generated per angle from that
// option's already-committed materials, one Yoxa Output Tool: Image call
// per image, so the natural shape is create-option-then-attach-images, not
// bundling images into the single call that creates the option.
export async function recordDesignOptionImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordDesignOptionImagesInput
) {
  const images = input.images ?? [];
  if (images.length === 0) {
    throw new ToolError(400, "At least one image is required");
  }

  const { data: option } = await supabase
    .from("design_options")
    .select("id")
    .eq("id", input.designOptionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!option) {
    throw new ToolError(404, "designOptionId does not exist for this project");
  }

  const rows = [];
  for (const image of images) {
    const stored = await fetchAndStoreImage(
      supabase,
      "project-attachments",
      `${projectId}/design-option-images/${input.designOptionId}/`,
      image.imageUrl
    );
    rows.push({
      design_option_id: input.designOptionId,
      storage_path: stored.storagePath,
      angle: image.angle ?? null,
      materials_shown: image.materialsShown ?? [],
    });
  }

  const { data: inserted, error } = await supabase.from("design_option_images").insert(rows).select();
  if (error) throw new ToolError(500, error.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "design_option_images_added",
    payload: { design_option_id: input.designOptionId, image_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent added ${inserted?.length ?? 0} visual(s) for a design option.`,
  });

  return { images: inserted ?? [] };
}
