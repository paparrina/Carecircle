import { createClient } from "@/lib/supabase/server";

export type CircleMember = { id: string; name: string; role: string };

export async function getMembers(circleId: string): Promise<CircleMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circle_members")
    .select("user_id, role, profiles:user_id(full_name)")
    .eq("circle_id", circleId)
    .order("joined_at");
  return (data ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.user_id as string,
      name: p?.full_name ?? "",
      role: m.role as string
    };
  });
}

export async function getMyRole(circleId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("circle_members")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role ?? null;
}
