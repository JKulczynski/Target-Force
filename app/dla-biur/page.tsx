import type { Metadata } from "next";
import { DokumentPrawny } from "@/components/DokumentPrawny";
import { dokumentPrawny } from "@/lib/prawne";
import { tlumacz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dokumentPrawny("dla-biur", await jezykZCookie()).tytul };
}

/** Strona publiczna dla biur poselskich i urzędów (14.10): zasady wysyłki gwarantowane przez WinOver. */
export default async function Strona() {
  const jezyk = await jezykZCookie();
  return <DokumentPrawny d={dokumentPrawny("dla-biur", jezyk)} t={tlumacz(jezyk)} />;
}
