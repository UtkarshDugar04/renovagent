"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck } from "lucide-react";

export interface PreferenceImage {
  id: string;
  url: string;
  caption: string | null;
  roomOrTheme: string | null;
}

type Reaction = "thumbs_up" | "thumbs_down" | "save";

// Pinterest/moodboard-style board for the Preference engine's real
// generated images — thumbs up/down feed back into evidence and readiness
// (see /api/projects/:projectId/preference-images/:imageId/react), save is
// a pure bookmark. Reactions are an append-only log, not a toggleable
// stored state, so this locks per-image after one click rather than
// reading back "current" reaction — same convention DesignOptionCard
// already uses for design feedback.
export function PreferenceImageBoard({ projectId, images }: { projectId: string; images: PreferenceImage[] }) {
  const [reacted, setReacted] = useState<Record<string, Reaction>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function react(imageId: string, reaction: Reaction) {
    setPendingId(imageId);
    startTransition(async () => {
      try {
        await fetch(`/api/projects/${projectId}/preference-images/${imageId}/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction }),
        });
        setReacted((prev) => ({ ...prev, [imageId]: reaction }));
      } finally {
        setPendingId(null);
      }
    });
  }

  if (images.length === 0) {
    return <p className="text-xs text-muted-foreground">No moodboard images yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((img) => {
        const reaction = reacted[img.id];
        const pending = pendingId === img.id;
        return (
          <div key={img.id} className="group relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs, not a fixed remote domain to configure for next/image */}
            <img
              src={img.url}
              alt={img.caption ?? "Preference reference image"}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2 pt-6">
              {img.roomOrTheme && (
                <span className="truncate text-[10px] font-medium text-white/90">{img.roomOrTheme}</span>
              )}
              <div className="ml-auto flex shrink-0 gap-1">
                {reaction ? (
                  <span className="rounded-full bg-white/20 p-1 text-white">
                    {reaction === "thumbs_up" && <ThumbsUp className="h-3.5 w-3.5" />}
                    {reaction === "thumbs_down" && <ThumbsDown className="h-3.5 w-3.5" />}
                    {reaction === "save" && <BookmarkCheck className="h-3.5 w-3.5" />}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      title="Like"
                      disabled={pending}
                      onClick={() => react(img.id, "thumbs_up")}
                      className="rounded-full bg-white/20 p-1 text-white transition-colors hover:bg-white/40 disabled:opacity-50"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Not this"
                      disabled={pending}
                      onClick={() => react(img.id, "thumbs_down")}
                      className="rounded-full bg-white/20 p-1 text-white transition-colors hover:bg-white/40 disabled:opacity-50"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Save"
                      disabled={pending}
                      onClick={() => react(img.id, "save")}
                      className="rounded-full bg-white/20 p-1 text-white transition-colors hover:bg-white/40 disabled:opacity-50"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {img.caption && (
              <p className="border-t border-border bg-card px-2 py-1.5 text-xs text-muted-foreground">
                {img.caption}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
