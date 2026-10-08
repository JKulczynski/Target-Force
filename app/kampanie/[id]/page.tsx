"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  kampania,
  liczbaKontaktow,
  usunKampanie,
  zmienKampanie,
} from "@/lib/store";
import { STATUSY, type Kampania } from "@/lib/types";
import { SkrzynkaKampanii } from "@/components/SkrzynkaKampanii";
import { Wiadomosci } from "@/components/Wiadomosci";
import { Wysylka } from "@/components/Wysylka";
import { Odbiorcy } from "@/components/Odbiorcy";
import { StronaAkcji } from "@/components/StronaAkcji";
import { Wplyw } from "@/components/Wplyw";
import { MomentSejmu } from "@/components/MomentSejmu";
import { Oswiadczenie } from "@/components/Oswiadczenie";
import { useT } from "@/lib/i18n/klient";

export default function SzczegolyKampanii() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [zListy, setZListy] = useState<number | null>(null);
  const [odswiezOdbiorcow, setOdswiezOdbiorcow] = useState(0);
  const [postep, setPostep] = useState<{
    wariantow: number;
    zatwierdzonePierwsze: number;
    odbiorcy: number;
    wyslane: number;
  } | null>(null);
  const [testWyslany, setTestWyslany] = useState(false);

  function odswiezPostep() {
    fetch(`/api/kampanie/${id}/wysylka`)
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => d && setPostep(d))
      .catch(() => {});
    Promise.resolve()
      .then(() => setTestWyslany(localStorage.getItem(`tf-test-${id}`) === "1"))
      .catch(() => {});
  }

  useEffect(() => {
    odswiezPostep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    kampania(id)
      .then((wynik) => setK(wynik ?? null))
      .catch(() => setK(null));
    liczbaKontaktow(id)
      .then(setZListy)
      .catch(() => setZListy(null));
  }, [id]);

  if (k === undefined)
    return <p className="text-sm text-slate-400">{t("wspolne.wczytuje")}</p>;
  if (k === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="font-medium text-slate-700">{t("kampania.brak.tytul")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("kampania.brak.opis")}</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-sm font-medium text-white"
        >
          {t("kampania.brak.wroc")}
        </Link>
      </div>
    );
  }

  const status = STATUSY[k.status];

  // Przewodnik "co dalej" (test Jana 02.10: gubił się na stronie kampanii). Kolejność = kolejność pracy.
  const kroki = [
    {
      nazwa: t("kampania.krok.zleceniodawca"),
      gotowe: k.zgodaZespolu === "zaakceptowana",
      href: "#zleca",
      podpowiedz:
        k.zgodaZespolu === "czeka"
          ? t("kampania.krok.zleceniodawca.czeka")
          : k.zgodaZespolu === "odrzucona"
            ? t("kampania.krok.zleceniodawca.odrzucone")
            : t("kampania.krok.zleceniodawca.wypelnij"),
    },
    {
      nazwa: t("kampania.krok.wiadomosci"),
      gotowe: (postep?.wariantow ?? 0) > 0,
      href: "#wiadomosci",
      podpowiedz: t("kampania.krok.wiadomosci.podp"),
    },
    {
      nazwa: t("kampania.krok.pierwsza"),
      gotowe: (postep?.zatwierdzonePierwsze ?? 0) > 0,
      href: "#wiadomosci",
      podpowiedz: t("kampania.krok.pierwsza.podp"),
    },
    {
      nazwa: t("kampania.krok.skrzynka"),
      gotowe: !!k.skrzynkaId,
      href: "#skrzynka",
      podpowiedz: t("kampania.krok.skrzynka.podp"),
    },
    {
      nazwa: t("kampania.krok.lista"),
      gotowe: (postep?.odbiorcy ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: t("kampania.krok.lista.podp"),
    },
    {
      nazwa: t("kampania.krok.test"),
      gotowe: testWyslany || (postep?.wyslane ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: t("kampania.krok.test.podp"),
    },
    {
      nazwa: t("kampania.krok.wysylka"),
      gotowe: (postep?.wyslane ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: t("kampania.krok.wysylka.podp"),
    },
  ];
  const nastepny = kroki.findIndex((x) => !x.gotowe);

  async function uruchom() {
    if (k!.zgodaZespolu !== "zaakceptowana") {
      window.alert(t("kampania.alertZgoda"));
      return;
    }
    const zmieniona = await zmienKampanie(k!.id, { status: "uruchomiona" });
    if (zmieniona) setK(zmieniona);
  }

  async function usun() {
    await usunKampanie(k!.id);
    router.push("/");
  }

  const gotowych = kroki.filter((x) => x.gotowe).length;

  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path
            d="M10 3 5 8l5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("nav.kampanie")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{k.nazwa}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("kampania.utworzona", { data: new Date(k.utworzona).toLocaleDateString(t.locale) })}
            {k.kogoSzukamy && <> · {k.kogoSzukamy}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/kampanie/${k.id}/raport`}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 hover:text-slate-900"
          >
            {t("kampania.raport")}
          </Link>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${status.klasa}`}
          >
            {t(`status.${k.status}`)}
          </span>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              {t("kampania.brief")}
            </h2>
            <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Wiersz etykieta={t("kampania.cel")} wartosc={k.cel} szeroki />
              <div>
                <p className="text-xs font-medium text-slate-500">{t("kampania.doKogo")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {k.zrodla.map((z) => (
                    <span
                      key={z}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {t(`zrodlo.${z}.nazwa`)}
                    </span>
                  ))}
                  {k.zrodla.includes("wlasna_lista") && (
                    <span className="text-xs text-slate-500">
                      {zListy === null ? "..." : t.n("kampania.naLiscie", zListy)}
                    </span>
                  )}
                </div>
              </div>
              <Wiersz etykieta={t("kampania.nadawca")} wartosc={k.nadawca} />
              <Wiersz etykieta={t("kampania.film")} wartosc={k.linkFilm} />
              <Wiersz
                etykieta={t("kampania.wiadomosci")}
                wartosc={`${t.n("kampania.wariant", k.liczbaWariantow)}${k.psychografia ? t("kampania.zPsychografia") : ""}`}
              />
              <Wiersz
                etykieta={t("kampania.przypomnienia")}
                wartosc={
                  k.liczbaFollowupow === 0
                    ? t("kampania.brakPrzypomnien")
                    : t("kampania.przypomnieniaCo", { n: k.liczbaFollowupow, dni: k.odstepDni })
                }
              />
              {k.materialy && (
                <Wiersz etykieta={t("kampania.materialy")} wartosc={k.materialy} szeroki />
              )}
            </div>
          </section>

          <div id="zleca" className="scroll-mt-20">
            <Oswiadczenie k={k} onZmiana={setK} />
          </div>

          <div id="wiadomosci" className="scroll-mt-20">
            <Wiadomosci
              kampaniaId={k.id}
              fakty={[
                k.nazwa,
                k.cel,
                k.materialy,
                k.nadawca,
                k.kogoSzukamy,
                k.linkFilm,
              ].join(" ")}
              onZmiana={odswiezPostep}
            />
          </div>

          <div id="skrzynka" className="scroll-mt-20">
            <SkrzynkaKampanii
              skrzynkaId={k.skrzynkaId}
              onZmiana={async (skrzynkaId) => {
                const zmieniona = await zmienKampanie(k.id, { skrzynkaId });
                if (zmieniona) setK(zmieniona);
                odswiezPostep();
              }}
            />
          </div>

          <div id="wysylka" className="scroll-mt-20">
            <Wysylka
              kampaniaId={k.id}
              kogoSzukamy={k.kogoSzukamy}
              maSkrzynke={!!k.skrzynkaId}
              zSejmu={k.zrodla.includes("sejm")}
              zSamorzadow={k.zrodla.includes("samorzady")}
              onZmiana={() => {
                setOdswiezOdbiorcow((n) => n + 1);
                odswiezPostep();
              }}
            />
          </div>

          <Odbiorcy kampaniaId={k.id} odswiez={odswiezOdbiorcow} />

          <div id="wplyw" className="scroll-mt-20">
            <Wplyw kampaniaId={k.id} zSejmu={k.zrodla.includes("sejm")} />
          </div>

          <div id="akcja" className="scroll-mt-20">
            <StronaAkcji
              k={k}
              odbiorcy={postep?.odbiorcy ?? 0}
              fakty={[k.nazwa, k.cel, k.materialy, k.nadawca, k.linkFilm].join(
                " ",
              )}
              onZmiana={setK}
            />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6">
            <button
              onClick={uruchom}
              disabled={k.status === "uruchomiona"}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {k.status === "uruchomiona"
                ? t("kampania.uruchomiona")
                : t("kampania.oznaczUruchomiona")}
            </button>
            <button
              onClick={usun}
              className="text-sm text-slate-500 transition-colors duration-150 hover:text-red-700"
            >
              {t("kampania.usun")}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {t("kampania.coDalej")}
              </h2>
              <span className="tabular text-xs text-slate-500">
                {gotowych}/{kroki.length}
              </span>
            </div>
            <div
              className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out-quart"
                style={{ width: `${(gotowych / kroki.length) * 100}%` }}
              />
            </div>
            <div className="mt-4 space-y-2.5">
              {kroki.map((x, i) => (
                <Krok
                  key={x.nazwa}
                  nazwa={x.nazwa}
                  gotowe={x.gotowe}
                  nastepny={i === nastepny}
                  href={x.href}
                />
              ))}
            </div>
            {nastepny >= 0 ? (
              <a
                href={kroki[nastepny].href}
                className="mt-5 block rounded-lg bg-brand-50 px-3.5 py-3 text-sm text-brand-800 ring-1 ring-brand-100 transition-colors duration-150 hover:bg-brand-100"
              >
                <span className="block text-xs font-medium text-brand-700">
                  {t("kampania.nastepnyKrok")}
                </span>
                <span className="mt-0.5 block first-letter:uppercase">
                  {kroki[nastepny].podpowiedz}
                </span>
              </a>
            ) : (
              <p className="mt-5 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
                {t("kampania.ruszyla")}
              </p>
            )}
          </section>
          {k.zrodla.includes("sejm") && (
            <div className="mt-4">
              <MomentSejmu start={k.start} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Wiersz({
  etykieta,
  wartosc,
  szeroki = false,
}: {
  etykieta: string;
  wartosc: string;
  szeroki?: boolean;
}) {
  const { t } = useT();
  return (
    <div className={szeroki ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium text-slate-500">{etykieta}</p>
      <p className="mt-1 max-w-[70ch] text-sm break-words text-slate-800">
        {wartosc || <span className="text-slate-400">{t("kampania.niePodano")}</span>}
      </p>
    </div>
  );
}

function Krok({
  nazwa,
  gotowe = false,
  nastepny = false,
  href,
}: {
  nazwa: string;
  gotowe?: boolean;
  nastepny?: boolean;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-md text-sm ${nastepny ? "font-medium" : ""}`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          gotowe
            ? "bg-emerald-100 text-emerald-700"
            : nastepny
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-300"
        }`}
      >
        {gotowe ? "✓" : nastepny ? "→" : ""}
      </span>
      <span
        className={
          gotowe
            ? "text-slate-700"
            : nastepny
              ? "text-slate-900"
              : "text-slate-400"
        }
      >
        {nazwa}
      </span>
    </a>
  );
}
