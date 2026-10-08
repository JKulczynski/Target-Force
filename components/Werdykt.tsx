"use client";

import type { WynikDomeny } from "@/lib/dns-poczty";
import { useT } from "@/lib/i18n/klient";

const PRYWATNE = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "wp.pl",
  "o2.pl",
  "onet.pl",
  "interia.pl",
];

export function Werdykt({ wynik }: { wynik: WynikDomeny }) {
  const { t } = useT();
  const stany = [wynik.spf.stan, wynik.dkim.stan, wynik.dmarc.stan];
  const [tekst, opis, styl] = stany.includes("brak")
    ? [t("werdykt.nieWysylaj"), t("werdykt.nieWysylaj.opis"), "bg-red-50 text-red-800 ring-red-100"]
    : stany.includes("slabe")
      ? [t("werdykt.mozna"), t("werdykt.mozna.opis"), "bg-amber-50 text-amber-900 ring-amber-100"]
      : [t("werdykt.gotowe"), t("werdykt.gotowe.opis"), "bg-emerald-50 text-emerald-800 ring-emerald-100"];
  const prywatna = PRYWATNE.includes(wynik.domena);
  return (
    <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${styl}`}>
      <p className="font-semibold">{tekst}</p>
      <p className="mt-0.5">{opis}</p>
      {prywatna && <p className="mt-2">{t("werdykt.prywatna", { domena: wynik.domena })}</p>}
    </div>
  );
}
