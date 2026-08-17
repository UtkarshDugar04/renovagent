"use client";

import { useRef, useState } from "react";
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
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-full border border-stone-300 px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50"
        title="Attach a photo or floor plan"
      >
        {uploading ? "…" : "📎"}
      </button>
    </>
  );
}
