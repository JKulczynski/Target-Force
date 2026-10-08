"use client";

import { useEffect, useState } from "react";
import {
  podpisyKampanii,
  warianty,
  zmienKampanie,
  type Podpis,
  type Wariant,
} from "@/lib/store";
import type { Kampania } from "@/lib/types";
import { POPRAWNY_SLUG, slugZNazwy } from "@/lib/akcja";
import { KartaWariantu } from "@/components/Wiadomosci";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

const pole = `mt-1.5 ${POLE}`;

/**
 * Panel strony akcji na stronie kampanii (wariant A, decyzja 07.10): treść strony, wiadomości dla sympatyków
 * z tym samym etapem zatwierdzania co wiadomości nadawcy, link publiczny i podpisy.
 */
export function StronaAkcji({
  k,
  odbiorcy,
  fakty,
  onZmiana,
}: {
  k: Kampania;
  odbiorcy: number;
  fakty: string;
  onZmiana: (k: Kampania) => void;
}) {
  const { t } = useT();
  const [wlaczona, setWlaczona] = useState(k.akcjaWlaczona);
  const [slug, setSlug] = useState(k.akcjaSlug ?? slugZNazwy(k.nazwa));
  const [tytul, setTytul] = useState(k.akcjaTytul);
  const [opis, setOpis] = useState(k.akcjaOpis);
  const [administrator, setAdministrator] = useState(k.akcjaAdministrator);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [lista, setLista] = useState<Wariant[] | null>(null);
  const [generuje, setGeneruje] = useState(false);
  const [podpisy, setPodpisy] = useState<Awaited<ReturnType<typeof podpisyKampanii>> | null>(null);
  const [skopiowano, setSkopiowano] = useState(false);

  const zmienione =
    wlaczona !== k.akcjaWlaczona ||
    slug !== (k.akcjaSlug ?? "") ||
    tytul !== k.akcjaTytul ||
    opis !== k.akcjaOpis ||
    administrator !== k.akcjaAdministrator;

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

  async function zapisz() {
    setBlad(null);
    const s = slug.trim();
    if (!POPRAWNY_SLUG.test(s)) return setBlad(t("akcjaPanel.bladSlug"));
    if (wlaczona && !tytul.trim()) return setBlad(t("akcjaPanel.bladTytul"));
    setZapisuje(true);
    try {
      const nowa = await zmienKampanie(k.id, {
        akcjaWlaczona: wlaczona,
        akcjaSlug: s,
        akcjaTytul: tytul.trim(),
        akcjaOpis: opis.trim(),
        akcjaAdministrator: administrator.trim(),
      });
      if (nowa) onZmiana(nowa);
    } catch (e) {
      setBlad(String(e).includes("duplicate") ? t("akcjaPanel.slugZajety") : t("wspolne.nieZapisano"));
    } finally {
      setZapisuje(false);
    }
  }

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
        <dl className="mt-5 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
          {[
            [t("akcjaPanel.podpisow"), podpisy.razem],
            [t("akcjaPanel.otworzyloPoczte"), podpisy.otworzyli],
            [t("akcjaPanel.udostepnilo"), podpisy.udostepnili],
          ].map(([e, v]) => (
            <div key={String(e)}>
              <dt className="text-xs text-slate-500">{e}</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">{t("akcjaPanel.tytulStrony")}</span>
          <input
            className={pole}
            value={tytul}
            onChange={(e) => setTytul(e.target.value)}
            placeholder={t("akcjaPanel.tytulStrony.ph")}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">{t("akcjaPanel.oCoChodzi")}</span>
          <textarea
            className={`${pole} min-h-32 resize-y`}
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            placeholder={t("akcjaPanel.oCoChodzi.ph")}
          />
          <span className="mt-1 block text-xs text-slate-500">{t("akcjaPanel.filmNadOpisem")}</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("akcjaPanel.adres")}</span>
          <div className="mt-1.5 flex items-center gap-1 text-sm text-slate-500">
            <span className="shrink-0">/a/</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t("akcjaPanel.administrator")}</span>
          <input
            className={pole}
            value={administrator}
            onChange={(e) => setAdministrator(e.target.value)}
            placeholder={t("akcjaPanel.administrator.ph")}
          />
        </label>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={wlaczona}
            onChange={(e) => setWlaczona(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-slate-700">{t("akcjaPanel.wlaczona")}</span>
            <span className="block text-slate-500">{t("akcjaPanel.wlaczona.opis")}</span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={zapisz}
          disabled={zapisuje || !zmienione}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
        >
          {zapisuje ? t("akcjaPanel.zapisuje") : t("akcjaPanel.zapiszStrone")}
        </button>
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </div>

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
                  <th className="py-2 font-medium">{t("akcjaPanel.kol.poczta")}</th>
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
                      {new Date(p.utworzony).toLocaleString(t.locale, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 text-slate-600">{p.otworzylPoczte ? t("akcjaPanel.otworzyl") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
