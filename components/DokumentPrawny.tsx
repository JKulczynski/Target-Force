import Link from "next/link";
import type { Dokument } from "@/lib/prawne";
import { WERSJA_PRAWNA } from "@/lib/prawne";
import type { Tlumacz } from "@/lib/i18n";

/** Wspólny układ regulaminu i polityki prywatności (strony publiczne, bez logowania). */
export function DokumentPrawny({ d, t }: { d: Dokument; t: Tlumacz }) {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
        {t("prawne.robocza", { wersja: WERSJA_PRAWNA })}
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{d.tytul}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{d.wstep}</p>
      {d.sekcje.map((s) => (
        <section key={s.tytul} className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">{s.tytul}</h2>
          {s.akapity.map((a) => (
            <p key={a.slice(0, 40)} className="mt-2 text-sm leading-relaxed text-slate-700">
              {a}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-10 text-sm">
        <Link href="/login" className="text-slate-500 hover:text-slate-900">
          {t("prawne.wroc")}
        </Link>
      </p>
    </article>
  );
}
