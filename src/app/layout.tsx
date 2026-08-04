import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { SwRegister } from "@/components/shared/sw-register";

export const metadata: Metadata = {
  title: "CareCircle — Cuidar juntos, aunque estemos lejos",
  description:
    "Coordinación familiar del cuidado de personas mayores: medicación, citas, documentos y avisos en un solo lugar.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#4A7FA7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider messages={messages}>
          {children}
          <SwRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
