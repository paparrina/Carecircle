import { createClient } from "@/lib/supabase/server";

const NO_CACHE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401, headers: NO_CACHE });

  const [profile, memberships, preferences] = await Promise.all([
    supabase.from("profiles").select("full_name, locale, created_at").eq("id", user.id).single(),
    supabase.from("circle_members").select("circle_id, role, joined_at").eq("user_id", user.id),
    supabase.from("notification_preferences").select("email_enabled, push_enabled").eq("user_id", user.id).maybeSingle()
  ]);
  if (profile.error || memberships.error || preferences.error) {
    return new Response(null, { status: 503, headers: NO_CACHE });
  }
  return Response.json({
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data,
    memberships: memberships.data,
    notificationPreferences: preferences.data ?? { email_enabled: true, push_enabled: false }
  }, { headers: { ...NO_CACHE, "Content-Disposition": 'attachment; filename="carecircle-account.json"' } });
}
