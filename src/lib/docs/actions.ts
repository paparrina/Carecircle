"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const recordSchema = z.object({
  circleId: z.string().uuid(),
  folderId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  storagePath: z.string().min(5).max(400),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().nonnegative(),
  sensitive: z.boolean()
});

/** Registra en BD un archivo ya subido a Storage por el cliente. */
export async function createDocumentRecord(
  input: z.infer<typeof recordSchema>
): Promise<{ error?: string }> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  // El path debe pertenecer al círculo declarado
  if (!d.storagePath.startsWith(`circles/${d.circleId}/`))
    return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("documents").insert({
    circle_id: d.circleId,
    folder_id: d.folderId,
    name: d.name,
    storage_path: d.storagePath,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes,
    sensitive: d.sensitive,
    uploaded_by: user.id
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}/docs`);
  return {};
}

/** URL firmada temporal para ver/descargar. La visibilidad la decide la RLS de `documents`. */
export async function getDocumentUrl(
  circleId: string,
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, sensitive")
    .eq("id", documentId)
    .eq("circle_id", circleId)
    .maybeSingle();
  if (!doc) return { error: "not_found" };

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, doc.sensitive ? 60 : 300);
  if (error || !data?.signedUrl) return { error: "generic" };
  return { url: data.signedUrl };
}

export async function deleteDocument(
  circleId: string,
  documentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("circle_id", circleId)
    .maybeSingle();
  if (!doc) return { error: "not_found" };

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) return { error: "generic" };
  await supabase.storage.from("documents").remove([doc.storage_path]);

  revalidatePath(`/app/${circleId}/docs`);
  return {};
}

export async function createFolder(
  circleId: string,
  name: string
): Promise<{ error?: string }> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 60) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_folders")
    .insert({ circle_id: circleId, name: clean });
  if (error) return { error: "generic" };
  revalidatePath(`/app/${circleId}/docs`);
  return {};
}
