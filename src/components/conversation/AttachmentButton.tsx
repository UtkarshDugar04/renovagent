"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface UploadedAttachment {
  id: string;
  label: string;
}

export function AttachmentButton({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (attachment: UploadedAttachment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("project-attachments")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: attachment, error: dbError } = await supabase
        .from("attachments")
        .insert({
          project_id: projectId,
          storage_path: path,
          mime_type: file.type,
          label: file.name,
          uploaded_by: user?.id,
        })
        .select("id, label")
        .single();

      if (dbError || !attachment) throw dbError;

      onUploaded({ id: attachment.id, label: attachment.label ?? file.name });

      // Fire-and-forget: the route responds immediately and does the real
      // Gemini pass in the background. Evidence it writes shows up on
      // /understanding via realtime, not through this response.
      fetch(`/api/projects/${projectId}/attachments/${attachment.id}/process`, { method: "POST" }).catch(() => {
        // Best-effort kickoff — if this request itself fails to even land,
        // the attachment just stays 'pending' rather than erroring the
        // upload the user already sees succeeded.
      });
    } catch {
      alert("Couldn't upload that file — try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        title="Attach a photo or floor plan"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </Button>
    </>
  );
}
