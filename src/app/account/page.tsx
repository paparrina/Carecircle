import { DeleteAccount } from "@/components/account/delete-account";
import Link from "next/link";
import { EmailSettings } from "@/components/account/email-settings";
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

  const { data: preferences, error: preferencesError } = await supabase.from("notification_preferences")
    .select("email_enabled").eq("user_id", user.id).maybeSingle();
  const settings = await getTranslations("accountSettings");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-4 text-2xl font-bold text-ink">{tc("accountTitle")}</h1>
      <Card>
        <p className="text-xl font-semibold text-ink">{profile?.full_name}</p>
        <p className="mt-1 text-[16px] text-ink-secondary">{user.email}</p>
      </Card>
      <Card className="mt-4">
        <h2 className="text-lg font-bold">{settings("notifications")}</h2>
        {preferencesError ? <p role="alert">{settings("error")}</p> :
          <EmailSettings enabled={preferences?.email_enabled ?? true} />}
      </Card>
      <Card className="mt-4">
        <h2 className="text-lg font-bold">{settings("privacy")}</h2>
        <p className="mt-2 text-ink-secondary">{settings("exportScope")}</p>
        <a href="/account/export" className="inline-flex min-h-touch items-center text-primary-dark underline">{settings("export")}</a>
        <Link href="/legal" className="block py-3 text-primary-dark underline">{settings("legal")}</Link>
        <DeleteAccount />
      </Card>
      <Link href="/app" className="mt-4 inline-flex min-h-touch items-center text-primary-dark underline">{settings("back")}</Link>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="secondary">
          {tc("signOut")}
        </Button>
      </form>
    </main>
  );
}
