import type { Metadata } from "next";
import { DokumentPrawny } from "@/components/DokumentPrawny";
import { dokumentPrawny } from "@/lib/prawne";
import { tlumacz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dokumentPrawny("prywatnosc", await jezykZCookie()).tytul };
}

/** Strona publiczna (proxy: bez logowania i bez paska aplikacji). Treść w lib/prawne.ts, wersja robocza do prawnika. */
export default async function Strona() {
  const jezyk = await jezykZCookie();
  return <DokumentPrawny d={dokumentPrawny("prywatnosc", jezyk)} t={tlumacz(jezyk)} />;
}
