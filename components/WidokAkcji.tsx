"use client";

import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/lib/i18n/klient";
import { youtubeId } from "@/lib/youtube";
import { stylKoloru, type WygladAkcji } from "@/lib/wyglad";

/**
 * Widok strony akcji: ten sam na stronie publicznej (/a/{slug}) i w podglądzie kreatora,
 * żeby to, co organizacja widzi przy projektowaniu, było dokładnie tym, co zobaczy mieszkaniec.
 * Formularz przychodzi z zewnątrz (na żywo AkcjaFormularz, w kreatorze atrapa).
 */
export function WidokAkcji({
  nadawca,
  tytul,
  opis,
  film,
  prowadzi,
  wyglad,
  formularz,
  waski = false,
  doPoslow = true,
}: {
  nadawca: string;
  tytul: string;
  opis: string;
  film: string;
  /** Gotowe zdanie "Kampanię prowadzi ..." albo pusty. */
  prowadzi: string;
  wyglad: WygladAkcji;
  formularz: ReactNode;
  /** Podgląd telefonu w kreatorze: jedna kolumna niezależnie od szerokości ekranu. */
  waski?: boolean;
  /** Jak w AkcjaFormularz: „poseł” albo „adresat” w opisie kroków. */
  doPoslow?: boolean;
}) {
  const { t } = useT();
  const yt = film ? youtubeId(film) : null;
  const akapity = opis
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const obrazNaGorze = wyglad.obraz && wyglad.uklad === "obraz";
  const kolumny = waski ? "grid gap-8" : "grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14";

  return (
    <div className="mx-auto max-w-5xl" style={stylKoloru(wyglad.kolor) as CSSProperties}>
      {obrazNaGorze && (
        // eslint-disable-next-line @next/next/no-img-element -- zdjęcie organizacji z magazynu Supabase, rozmiar nieznany
        <img src={wyglad.obraz} alt="" className="mb-8 aspect-[21/9] w-full rounded-2xl object-cover" />
      )}
      <div className={kolumny}>
        <article>
          {(nadawca || wyglad.logo) && (
            <div className="flex items-center gap-2.5">
              {wyglad.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- logo organizacji z magazynu Supabase
                <img src={wyglad.logo} alt="" className="h-8 w-auto max-w-32 object-contain" />
              )}
              {nadawca && <p className="text-sm font-medium text-brand-700">{nadawca}</p>}
            </div>
          )}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{tytul}</h1>
          {yt ? (
            <div className="mt-6 aspect-video overflow-hidden rounded-xl bg-slate-900">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${yt}`}
                title={t("akcja.film")}
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : wyglad.obraz && !obrazNaGorze ? (
            // eslint-disable-next-line @next/next/no-img-element -- zdjęcie organizacji z magazynu Supabase
            <img src={wyglad.obraz} alt="" className="mt-6 aspect-video w-full rounded-xl object-cover" />
          ) : (
            film && (
              <a
                href={film}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-block text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
              >
                {t("akcja.zobaczFilm")}
              </a>
            )
          )}
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-slate-700">
            {akapity.length ? (
              akapity.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-slate-500">{t("akcja.opisWkrotce")}</p>
            )}
          </div>
          {prowadzi && <p className="mt-6 text-xs leading-relaxed text-slate-500">{prowadzi}</p>}
          <div className="mt-8 rounded-xl bg-slate-100 p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{t("akcja.jakDziala")}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>{t(doPoslow ? "akcja.jak1" : "akcja.jak1Urzad")}</li>
              <li>{t("akcja.jak2")}</li>
              <li>{t("akcja.jak3")}</li>
            </ol>
          </div>
        </article>
        <aside className={waski ? "" : "lg:sticky lg:top-20 lg:self-start"}>{formularz}</aside>
      </div>
    </div>
  );
}

/** Pasek postępu do celu ("312 z 500"). Wspólny dla formularza na żywo i atrapy w kreatorze. */
export function PasekCelu({ razem, cel }: { razem: number; cel: number }) {
  const { t } = useT();
  const procent = Math.min(100, Math.round((razem / cel) * 100));
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={razem} aria-valuemax={cel}>
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${procent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{t("akcja.celZ", { razem, cel })}</p>
    </div>
  );
}
