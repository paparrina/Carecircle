"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema } from "@/lib/validators";
import type { z } from "zod";

export async function createPost(
  input: z.infer<typeof postSchema>
): Promise<{ error?: string }> {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  if (d.body.length === 0 && d.attachments.length === 0)
    return { error: "empty" };
  for (const a of d.attachments)
    if (!a.storage_path.startsWith(`circles/${d.circleId}/`))
      return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("posts").insert({
    circle_id: d.circleId,
    author_id: user.id,
    body: d.body || null,
    attachments: d.attachments,
    mentions: d.mentions
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  return {};
}

export async function deletePost(
  circleId: string,
  postId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("attachments")
    .eq("id", postId)
    .eq("circle_id", circleId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: "generic" };

  // Antes de esto, borrar un post no borraba nunca sus fotos: se quedaban
  // huérfanas en Storage para siempre. Mejor esfuerzo: si falla, se registra
  // pero no se deshace el borrado del post (ya no tiene fila que lo referencie).
  const paths = ((post?.attachments ?? []) as { storage_path?: string }[])
    .map((a) => a.storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove(paths);
    if (storageError) {
      console.error(
        `deletePost: no se pudieron borrar ${paths.length} adjunto(s) huérfano(s) del post ${postId}:`,
        storageError.message
      );
    }
  }

  revalidatePath(`/app/${circleId}/wall`);
  return {};
}

export async function createComment(
  input: z.infer<typeof commentSchema>
): Promise<{ error?: string }> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("post_comments").insert({
    post_id: parsed.data.postId,
    author_id: user.id,
    body: parsed.data.body
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${parsed.data.circleId}/wall`);
  return {};
}

export async function deleteComment(circleId: string, commentId: string) {
  const supabase = await createClient();
  await supabase.from("post_comments").delete().eq("id", commentId);
  revalidatePath(`/app/${circleId}/wall`);
}
