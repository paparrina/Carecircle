"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, magicLinkSchema, signupSchema } from "@/lib/validators";
import { safeNextPath } from "@/lib/auth/safe-redirect";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** URL de retorno tras el intercambio de código, con el destino (?next=) ya validado. */
function callbackUrl(next: string) {
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

export type AuthState = { error?: string; message?: string } | null;

export async function loginWithPassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) return { error: "credentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "credentials" };

  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next") as string));
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: callbackUrl(formData.get("next") as string)
    }
  });
  if (error) return { error: "generic" };
  return { message: "signupSuccess" };
}

export async function sendMagicLink(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(formData.get("next") as string) }
  });
  if (error) return { error: "generic" };
  return { message: "magicLinkSent" };
}

export async function loginWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(formData.get("next") as string) }
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
