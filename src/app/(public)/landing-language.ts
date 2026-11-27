"use server";

import { cookies } from "next/headers";

export async function setLandingLanguage(form: FormData) {
  const locale = form.get("locale");
  if (locale !== "es" && locale !== "en") return;
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax", maxAge: 31536000 });
}
