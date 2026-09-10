"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Marca como leídos solo los avisos indicados (los que la página realmente ha
 * mostrado). Antes se marcaban como leídos TODOS los avisos pendientes del
 * círculo sin comprobar cuántos se habían renderizado: con más de los 50 que
 * carga la página, los que quedaban fuera de esa página desaparecían como
 * "no leídos" sin que la persona los hubiera visto nunca.
 */
export async function markNotificationsRead(circleId: string, ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("circle_id", circleId)
    .in("id", ids)
    .is("read_at", null);
  revalidatePath(`/app/${circleId}`, "layout");
}

