"use client";

import type { WynikDomeny } from "@/lib/dns-poczty";

const PRYWATNE = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "wp.pl", "o2.pl", "onet.pl", "interia.pl"];

export function Werdykt({ wynik }: { wynik: WynikDomeny }) {
  const stany = [wynik.spf.stan, wynik.dkim.stan, wynik.dmarc.stan];
  const [tekst, opis, styl] = stany.includes("brak")
    ? ["Nie wysyłaj jeszcze", "Czerwone światło: maile trafią do spamu albo nie dojdą. Popraw je przed kampanią.", "bg-red-50 text-red-800 ring-red-100"]
    : stany.includes("slabe")
      ? ["Można wysyłać", "Zielone = działa. Żółte = działa, ale da się ustawić lepiej. Nie blokuje wysyłki.", "bg-amber-50 text-amber-900 ring-amber-100"]
      : ["Gotowe do wysyłki", "Wszystkie trzy ustawienia są w porządku.", "bg-emerald-50 text-emerald-800 ring-emerald-100"];
  const prywatna = PRYWATNE.includes(wynik.domena);
  return (
    <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${styl}`}>
      <p className="font-semibold">{tekst}</p>
      <p className="mt-0.5">{opis}</p>
      {prywatna && (
        <p className="mt-2">
          To prywatna skrzynka ({wynik.domena}): dobra do testów, ale ma limit ok. 500 maili dziennie. Na kampanię użyj
          adresu w domenie firmy albo organizacji.
        </p>
      )}
    </div>
  );
}
