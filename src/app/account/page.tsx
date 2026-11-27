import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-4 text-2xl font-bold text-ink">{tc("accountTitle")}</h1>
      <Card>
        <p className="text-xl font-semibold text-ink">{profile?.full_name}</p>
        <p className="mt-1 text-[16px] text-ink-secondary">{user.email}</p>
      </Card>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary">
          {tc("signOut")}
        </Button>
      </form>
    </main>
  );
}
