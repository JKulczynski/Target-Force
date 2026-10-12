"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  podpisyKampanii,
  warianty,
  type Podpis,
  type Wariant,
} from "@/lib/store";
import type { Kampania } from "@/lib/types";
import { KartaWariantu } from "@/components/Wiadomosci";
import { Sympatycy } from "@/components/Sympatycy";
import { useT } from "@/lib/i18n/klient";

/**
 * Panel strony akcji na stronie kampanii: wejście do kreatora strony (12.10), wiadomości dla sympatyków
 * z tym samym etapem zatwierdzania co wiadomości nadawcy, link publiczny, widżet i podpisy ze statusem wysyłki.
 */
export function StronaAkcji({
  k,
  odbiorcy,
  fakty,
}: {
  k: Kampania;
  odbiorcy: number;
  fakty: string;
  /** Nieużywane od kreatora strony (12.10): treść strony zapisuje /kampanie/{id}/strona. */
  onZmiana?: (k: Kampania) => void;
}) {
  const { t } = useT();
  const [blad, setBlad] = useState<string | null>(null);
  const [lista, setLista] = useState<Wariant[] | null>(null);
  const [generuje, setGeneruje] = useState(false);
  const [podpisy, setPodpisy] = useState<Awaited<ReturnType<typeof podpisyKampanii>> | null>(null);
  const [skopiowano, setSkopiowano] = useState(false);


  async function wczytaj() {
    const [w, p] = await Promise.all([
      warianty(k.id, "sympatyk").catch(() => [] as Wariant[]),
      podpisyKampanii(k.id).catch(() => null),
    ]);
    setLista(w);
    setPodpisy(p);
  }

  useEffect(() => {
    let aktualny = true;
    Promise.all([
      warianty(k.id, "sympatyk").catch(() => [] as Wariant[]),
      podpisyKampanii(k.id).catch(() => null),
    ]).then(([w, p]) => {
      if (!aktualny) return;
      setLista(w);
      setPodpisy(p);
    });
    return () => {
      aktualny = false;
    };
  }, [k.id]);



  async function generuj() {
    setGeneruje(true);
    setBlad(null);
    try {
      const odp = await fetch(`/api/kampanie/${k.id}/generuj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rola: "sympatyk" }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? t("wiadomosci.bladGenerowania"));
      await wczytaj();
    } catch {
      setBlad(t("wiadomosci.bladGenerowania"));
    } finally {
      setGeneruje(false);
    }
  }

  const aktywne = (lista ?? []).filter((w) => w.status !== "odrzucony");
  const zatwierdzone = aktywne.filter((w) => w.status === "zatwierdzony").length;
  const adres =
    typeof window !== "undefined" && k.akcjaSlug
      ? `${window.location.origin}/a/${k.akcjaSlug}`
      : null;

  const gotowosc = [
    { nazwa: t("akcjaPanel.got.lista"), ok: odbiorcy > 0 },
    { nazwa: t("akcjaPanel.got.wariant"), ok: zatwierdzone > 0 },
    { nazwa: t("akcjaPanel.got.strona"), ok: k.akcjaWlaczona && !!k.akcjaSlug },
  ];

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {t("akcjaPanel.tytul")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("akcjaPanel.opis")}</p>
        </div>
        {adres && k.akcjaWlaczona && (
          <div className="flex items-center gap-2">
            <a
              href={adres}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900"
            >
              {t("akcjaPanel.otworz")}
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(adres);
                  setSkopiowano(true);
                } catch {
                  setSkopiowano(false);
                }
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              {skopiowano ? t("akcjaPanel.skopiowano") : t("akcjaPanel.kopiuj")}
            </button>
          </div>
        )}
      </div>

      <ul className="mt-5 space-y-1.5">
        {gotowosc.map((g) => (
          <li key={g.nazwa} className="flex items-center gap-2.5 text-sm">
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-xs ${g.ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
              aria-hidden
            >
              {g.ok ? "✓" : ""}
            </span>
            <span className={g.ok ? "text-slate-700" : "text-slate-500"}>{g.nazwa}</span>
          </li>
        ))}
      </ul>

      {adres && k.akcjaWlaczona && <Widzet adres={adres} />}

      {podpisy && podpisy.zrodla.length > 0 && (
        <div className="mt-5 rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">{t("akcjaPanel.skad")}</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {podpisy.zrodla.map((z) => (
              <li key={z.nazwa}>
                <span className="font-semibold tabular-nums text-slate-900">{z.ile}</span>{" "}
                <span className="text-slate-600">{z.nazwa}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            {t("akcjaPanel.utm", {
              adres: adres ? `${adres}?utm_source=facebook&utm_medium=reklama` : "…?utm_source=facebook&utm_medium=reklama",
            })}
          </p>
        </div>
      )}

      {podpisy && (podpisy.razem > 0 || k.akcjaWlaczona) && (
        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            [t("akcjaPanel.podpisow"), podpisy.razem],
            [t("akcjaPanel.wyslali"), podpisy.wyslali],
            [t("akcjaPanel.czekaja"), podpisy.czekaja],
            [t("akcjaPanel.otworzyloPoczte"), podpisy.otworzyli],
            [t("akcjaPanel.odpowiedzi"), podpisy.odpowiedzi],
            [t("akcjaPanel.udostepnilo"), podpisy.udostepnili],
          ].map(([e, v]) => (
            <div key={String(e)}>
              <dt className="text-xs text-slate-500">{e}</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <Link
        href={`/kampanie/${k.id}/strona`}
        className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 transition-colors duration-150 hover:bg-brand-100"
      >
        <span>
          <span className="block text-sm font-medium text-slate-900">{t("akcjaPanel.zaprojektuj")}</span>
          <span className="block text-xs text-slate-600">{t("akcjaPanel.zaprojektuj.opis")}</span>
        </span>
        <span aria-hidden className="text-brand-700">→</span>
      </Link>
      {blad && <p className="mt-3 text-sm text-red-700">{blad}</p>}

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-slate-900">{t("akcjaPanel.sympatycy.tytul")}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t("akcjaPanel.sympatycy.opis")} {t("wiadomosci.zatwierdzoneA")}{" "}
              <span className="font-semibold text-slate-900">{zatwierdzone}</span>{" "}
              {t("wiadomosci.zatwierdzoneB", { razem: aktywne.length })}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (aktywne.length && !window.confirm(t("akcjaPanel.potwierdzRegeneracje"))) return;
              generuj();
            }}
            disabled={generuje}
            className={
              aktywne.length
                ? "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50"
                : "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
            }
          >
            {generuje
              ? t("wiadomosci.pisze")
              : aktywne.length
                ? t("wiadomosci.ponownie")
                : t("akcjaPanel.wygenerujSympatykow")}
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {aktywne.map((w) => (
            <KartaWariantu key={w.id} w={w} fakty={fakty} onZmiana={wczytaj} />
          ))}
        </div>
      </div>

      {podpisy && podpisy.lista.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="font-medium text-slate-900">{t("akcjaPanel.ostatniePodpisy")}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.kto")}</th>
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.gmina")}</th>
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.doKogo")}</th>
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.kiedy")}</th>
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.status")}</th>
                  <th className="py-2 pr-4 font-medium">{t("akcjaPanel.kol.zrodlo")}</th>
                  <th className="py-2 font-medium">{t("akcjaPanel.kol.email")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {podpisy.lista.map((p: Podpis) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 text-slate-800">
                      {[p.imie, p.nazwisko].filter(Boolean).join(" ")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{p.gminaNazwa}</td>
                    <td className="max-w-64 truncate py-2 pr-4 text-slate-600">{p.odbiorcaNazwa}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-500">
                      {new Date(p.wyslano ?? p.utworzony).toLocaleString(t.locale, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                      {p.statusWysylki
                        ? t(`akcjaPanel.status.${p.statusWysylki as "wyslany" | "w_kolejce" | "czeka_na_potwierdzenie" | "blad"}`)
                        : p.otworzylPoczte
                          ? t("akcjaPanel.otworzyl")
                          : t("akcjaPanel.status.podpisal")}
                      {p.zglosilOdpowiedz && ` · ${t("akcjaPanel.odpisal")}`}
                    </td>
                    <td className="max-w-40 truncate py-2 pr-4 text-slate-500">{p.zrodlo}</td>
                    <td className="py-2 text-slate-600">{p.email ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {podpisy && <Sympatycy kampaniaId={k.id} nazwa={k.nazwa} zgodyKontakt={podpisy.zgodyKontakt} />}
    </section>
  );
}

/**
 * Widżet (blok B, 12.10): kod do wklejenia na stronę klienta. Strona akcji w trybie osadzonym (?osadzona=1)
 * nie ma przełącznika języka ani stopki; utm_source=widzet pokazuje w panelu "Skąd przyszli", ile podpisów dał widżet.
 */
function Widzet({ adres }: { adres: string }) {
  const { t } = useT();
  const [skopiowano, setSkopiowano] = useState(false);
  const kod = `<iframe src="${adres}?osadzona=1&utm_source=widzet" title="WinOver" style="width:100%;min-height:900px;border:0" loading="lazy"></iframe>`;
  return (
    <details className="mt-5 rounded-lg border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">{t("akcjaPanel.widzet")}</summary>
      <p className="mt-2 text-sm text-slate-600">{t("akcjaPanel.widzet.opis")}</p>
      <textarea readOnly value={kod} rows={3} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(kod);
            setSkopiowano(true);
          } catch {
            setSkopiowano(false);
          }
        }}
        className="mt-2 text-sm text-slate-600 hover:text-slate-900"
      >
        {skopiowano ? t("akcjaPanel.skopiowano") : t("akcjaPanel.widzet.kopiuj")}
      </button>
    </details>
  );
}
