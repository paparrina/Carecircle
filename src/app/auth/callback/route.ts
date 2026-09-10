import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-redirect";

// Intercambia el código OAuth / magic link por una sesión.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // La URL es pública y puede compartirse/reenviarse: no confiar en `next` sin validar,
  // aunque los puntos de entrada de la propia app ya lo hagan (defensa en profundidad
  // contra un open redirect vía /auth/callback?next=...).
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
