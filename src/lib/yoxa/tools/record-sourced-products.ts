import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

export interface SourcedProductInput {
  vendorName: string;
  productName: string;
  productUrl?: string;
  price?: number;
  notes?: string;
}

export interface RecordSourcedProductsInput {
  designOptionId: string;
  products: SourcedProductInput[];
}

// Shared logic behind recordSourcedProducts — the real vendors and
// products the Sourcing Agent found for one already-registered design
// option (call recordProposedDesignPackage first and use the returned
// option id, same precondition as recordDesignOptionImages). Written by
// the Design Agent, not Sourcing itself: Sourcing never receives a real
// designOptionId — that's created after its work, when Design calls
// recordProposedDesignPackage with the sourcing-informed option set — so
// Design is the one who can link what Sourcing found back to a real row.
export async function recordSourcedProducts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordSourcedProductsInput
) {
  const products = input.products ?? [];
  if (products.length === 0) {
    throw new ToolError(400, "At least one sourced product is required");
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

  const rows = products.map((p) => ({
    design_option_id: input.designOptionId,
    vendor_name: p.vendorName,
    product_name: p.productName,
    product_url: p.productUrl ?? null,
    price: p.price ?? null,
    notes: p.notes ?? null,
  }));

  const { data: inserted, error } = await supabase.from("sourced_products").insert(rows).select();
  if (error) throw new ToolError(500, error.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "sourced_products_added",
    payload: { design_option_id: input.designOptionId, product_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent recorded ${inserted?.length ?? 0} real sourced product(s) for a design option.`,
  });

  return { products: inserted ?? [] };
}
