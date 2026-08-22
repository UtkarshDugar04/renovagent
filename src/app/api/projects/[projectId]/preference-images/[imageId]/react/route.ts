import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getProjectRole } from "@/lib/auth/project-access";
import { applyPreferenceImageReaction } from "@/lib/dna/preference-image-reaction";

const VALID_REACTIONS = ["thumbs_up", "thumbs_down", "save"] as const;

// POST /api/projects/:projectId/preference-images/:imageId/react
// A click is already fully classified the moment it happens, so this is a
// direct-insert route like the HITL respond route, not the free-text
// classification pipeline design feedback goes through. Auth via
// getProjectRole (not a raw project_members query) so agency/admin staff
// who aren't an explicit project_members row can react too — that exact
// raw-query mistake was already made and fixed once today in the HITL
// respond route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!role) return NextResponse.json({ error: "Not a member of this project" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const reaction = body?.reaction;
  if (!VALID_REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: `reaction must be one of ${VALID_REACTIONS.join(", ")}` }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: image } = await service
    .from("preference_images")
    .select("id, caption")
    .eq("id", imageId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await applyPreferenceImageReaction(service, {
    preferenceImageId: imageId,
    projectId,
    reaction,
    imageCaption: image.caption,
    createdBy: user.id,
  });

  return NextResponse.json({ ok: true });
}
