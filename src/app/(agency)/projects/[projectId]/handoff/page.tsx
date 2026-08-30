import { createClient } from "@/lib/supabase/server";
import { HandoffPanel } from "./handoff-panel";

export default async function HandoffPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("handoff_records")
    .select("id, brief, status, email_sent_to, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Handoff carries forward the validated design direction — the option(s)
  // that survived review, not every explored proposal — since this is what
  // later execution stages actually build from.
  const { data: options } = await supabase
    .from("design_options")
    .select("id, label")
    .eq("project_id", projectId)
    .eq("status", "validated");

  const { data: optionImages } = options?.length
    ? await supabase
        .from("design_option_images")
        .select("id, design_option_id, storage_path, angle")
        .in("design_option_id", options.map((o) => o.id))
    : { data: [] };

  const { data: sourcedProducts } = options?.length
    ? await supabase
        .from("sourced_products")
        .select("id, design_option_id, vendor_name, product_name, product_url, price, currency")
        .in("design_option_id", options.map((o) => o.id))
    : { data: [] };

  const labelByOption = new Map((options ?? []).map((o) => [o.id, o.label]));
  const imagesByOption = new Map<
    string,
    {
      optionLabel: string;
      images: { id: string; url: string; angle: string | null }[];
      products: { id: string; vendor_name: string; product_name: string; product_url: string | null; price: number | null; currency: string }[];
    }
  >();
  function refFor(optionId: string) {
    const existing = imagesByOption.get(optionId);
    if (existing) return existing;
    const created = { optionLabel: labelByOption.get(optionId) ?? "Design option", images: [], products: [] };
    imagesByOption.set(optionId, created);
    return created;
  }
  for (const img of optionImages ?? []) {
    const { data } = await supabase.storage.from("project-attachments").createSignedUrl(img.storage_path, 3600);
    refFor(img.design_option_id).images.push({ id: img.id, url: data?.signedUrl ?? "", angle: img.angle });
  }
  for (const p of sourcedProducts ?? []) {
    refFor(p.design_option_id).products.push(p);
  }

  // Latest floor plan, if Spatial has produced one — an execution team
  // needs the room geometry alongside the chosen design, not just the
  // design images on their own.
  const { data: spatialArtifact } = await supabase
    .from("project_artifacts")
    .select("id, image_storage_path")
    .eq("project_id", projectId)
    .eq("engine", "spatial")
    .not("image_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let floorPlanUrl: string | null = null;
  if (spatialArtifact?.image_storage_path) {
    const { data } = await supabase.storage
      .from("project-attachments")
      .createSignedUrl(spatialArtifact.image_storage_path, 3600);
    floorPlanUrl = data?.signedUrl ?? null;
  }

  return (
    <HandoffPanel
      projectId={projectId}
      records={records ?? []}
      designReferences={Array.from(imagesByOption.values())}
      floorPlanUrl={floorPlanUrl}
    />
  );
}
