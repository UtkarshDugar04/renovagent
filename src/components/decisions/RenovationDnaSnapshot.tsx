import { createClient } from "@/lib/supabase/server";

const DOMAIN_LABEL: Record<string, string> = {
  family: "Family",
  spatial: "Spatial",
  preference: "Preference",
  budget: "Budget",
  constraint: "Constraint",
};

// Renders the current Renovation DNA's actual visual outputs — engine
// artifacts (persona doc, floor plan, budget breakdown, constraint
// bullets), the preference moodboard, and design option images — inline
// above any human decision point. A human approving or confirming
// something about the DNA should be looking at what it actually contains,
// not just Yoxa's prose description of the decision. Returns null when
// nothing has been generated yet, so it never shows an empty box.
export async function RenovationDnaSnapshot({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const [{ data: artifacts }, { data: preferenceImages }, { data: designOptions }] = await Promise.all([
    supabase
      .from("project_artifacts")
      .select("id, engine, artifact_type, content, image_storage_path, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("preference_images")
      .select("id, storage_path, caption")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("design_options")
      .select("id, label")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  const latestArtifacts = new Map<string, NonNullable<typeof artifacts>[number]>();
  for (const a of artifacts ?? []) {
    const key = `${a.engine}:${a.artifact_type}`;
    if (!latestArtifacts.has(key)) latestArtifacts.set(key, a);
  }

  const artifactImageUrls = new Map<string, string>();
  for (const a of latestArtifacts.values()) {
    if (!a.image_storage_path) continue;
    const { data } = await supabase.storage.from("project-attachments").createSignedUrl(a.image_storage_path, 3600);
    if (data?.signedUrl) artifactImageUrls.set(a.id, data.signedUrl);
  }

  const moodboardThumbs = await Promise.all(
    (preferenceImages ?? []).slice(0, 6).map(async (img) => {
      const { data } = await supabase.storage.from("project-attachments").createSignedUrl(img.storage_path, 3600);
      return { id: img.id, url: data?.signedUrl ?? "", caption: img.caption };
    })
  );

  let designThumbs: { id: string; url: string; label: string }[] = [];
  if ((designOptions ?? []).length > 0) {
    const { data: designImages } = await supabase
      .from("design_option_images")
      .select("id, design_option_id, storage_path")
      .in("design_option_id", (designOptions ?? []).map((o) => o.id));
    const labelById = new Map((designOptions ?? []).map((o) => [o.id, o.label]));
    designThumbs = await Promise.all(
      (designImages ?? []).slice(0, 8).map(async (img) => {
        const { data } = await supabase.storage.from("project-attachments").createSignedUrl(img.storage_path, 3600);
        return { id: img.id, url: data?.signedUrl ?? "", label: labelById.get(img.design_option_id) ?? "" };
      })
    );
  }

  const domainArtifacts = [...latestArtifacts.values()];
  const hasAnything = domainArtifacts.length > 0 || moodboardThumbs.length > 0 || designThumbs.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Current Renovation DNA — review before deciding
      </p>

      {domainArtifacts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {domainArtifacts.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {DOMAIN_LABEL[a.engine] ?? a.engine} — {a.artifact_type}
              </div>
              {a.image_storage_path ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
                <img
                  src={artifactImageUrls.get(a.id) ?? ""}
                  alt={`${a.engine} ${a.artifact_type}`}
                  className="max-h-[220px] w-full bg-white object-contain"
                />
              ) : (
                <iframe
                  srcDoc={a.content ?? ""}
                  sandbox=""
                  className="h-[220px] w-full border-0 bg-white"
                  title={`${a.engine} ${a.artifact_type}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {moodboardThumbs.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Preference moodboard</p>
          <div className="flex gap-2 overflow-x-auto">
            {moodboardThumbs.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
              <img
                key={img.id}
                src={img.url}
                alt={img.caption ?? ""}
                className="h-20 w-28 shrink-0 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {designThumbs.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Design options</p>
          <div className="flex gap-2 overflow-x-auto">
            {designThumbs.map((img) => (
              <figure key={img.id} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL */}
                <img src={img.url} alt={img.label} className="h-20 w-28 rounded-md border border-border object-cover" />
                <figcaption className="mt-0.5 text-[10px] text-muted-foreground">{img.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
