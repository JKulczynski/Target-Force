"use client";

import { useEffect, useState } from "react";
import { Werdykt } from "@/components/Werdykt";
import type { WynikDomeny } from "@/lib/dns-poczty";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

type Skrzynka = {
  id: string;
  nazwa: string;
  email_nadawcy: string;
  smtp_host: string;
  smtp_port: number;
  dzienny_limit: number;
};

const pole = POLE;
const przycisk =
  "shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300";

/**
 * Skrzynka nadawcy przypisana do jednej kampanii (decyzja Jana 30.09: każda sprawa ma swoją skrzynkę,
 * żeby adresy nie mieszały się między kampaniami).
 */
export function SkrzynkaKampanii({
  skrzynkaId,
  onZmiana,
}: {
  skrzynkaId: string | null;
  onZmiana: (id: string | null) => Promise<void>;
}) {
  const { t } = useT();
  const [lista, setLista] = useState<Skrzynka[]>([]);

  async function wczytaj() {
    const odp = await fetch("/api/skrzynka");
    if (odp.ok) setLista(await odp.json());
  }

  useEffect(() => {
    let aktualny = true;
    fetch("/api/skrzynka")
      .then((odp) => (odp.ok ? odp.json() : []))
      .then((d) => aktualny && setLista(d))
      .catch(() => {});
    return () => {
      aktualny = false;
    };
  }, []);

  const wybrana = lista.find((s) => s.id === skrzynkaId);

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">
        {t("skrzynka.tytul")}
      </h2>
      {wybrana ? (
        <Podlaczona s={wybrana} onOdlacz={() => onZmiana(null)} />
      ) : (
        <Wybor
          lista={lista}
          onWybierz={onZmiana}
          onNowa={async (id) => {
            await wczytaj();
            await onZmiana(id);
          }}
        />
      )}
    </section>
  );
}

function Podlaczona({ s, onOdlacz }: { s: Skrzynka; onOdlacz: () => void }) {
  const { t } = useT();
  const [domena, setDomena] = useState<WynikDomeny | null>(null);
  const [odbiorca, setOdbiorca] = useState("");
  const [trwa, setTrwa] = useState(false);
  const [wynik, setWynik] = useState<{ ok: boolean; tekst: string } | null>(
    null,
  );

  useEffect(() => {
    fetch(`/api/domena?d=${encodeURIComponent(s.email_nadawcy)}`)
      .then((o) => (o.ok ? o.json() : null))
      .then(setDomena)
      .catch(() => setDomena(null));
  }, [s.email_nadawcy]);

  async function test() {
    setTrwa(true);
    setWynik(null);
    try {
      const odp = await fetch("/api/skrzynka/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, do: odbiorca }),
      });
      const dane = await odp.json();
      setWynik(
        odp.ok
          ? { ok: true, tekst: t("skrzynka.dziala", { do: dane.do }) }
          : { ok: false, tekst: dane.blad ?? t("skrzynka.nieWyslano") },
      );
    } catch {
      setWynik({ ok: false, tekst: t("skrzynka.nieWyslano") });
    } finally {
      setTrwa(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {s.nazwa !== s.email_nadawcy ? `${s.nazwa} · ` : ""}
            {s.email_nadawcy}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {t("skrzynka.polaczenie", { n: s.dzienny_limit })}
          </p>
        </div>
        <button
          onClick={onOdlacz}
          className="text-xs text-slate-400 transition hover:text-red-600"
        >
          {t("skrzynka.zmien")}
        </button>
      </div>
      {domena && <Werdykt wynik={domena} />}
      <div className="flex gap-3">
        <input
          className={pole}
          type="email"
          value={odbiorca}
          onChange={(e) => setOdbiorca(e.target.value)}
          placeholder={t("skrzynka.testPh", { email: s.email_nadawcy })}
        />
        <button onClick={test} disabled={trwa} className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50">
          {trwa ? t("skrzynka.sprawdzam") : t("skrzynka.sprawdz")}
        </button>
      </div>
      {wynik && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ring-1 ${wynik.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}
        >
          {wynik.tekst}
        </p>
      )}
    </div>
  );
}

function Wybor({
  lista,
  onWybierz,
  onNowa,
}: {
  lista: Skrzynka[];
  onWybierz: (id: string) => Promise<void>;
  onNowa: (id: string) => Promise<void>;
}) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [inny, setInny] = useState(false);
  const [trwa, setTrwa] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function podlacz(e: React.FormEvent) {
    e.preventDefault();
    setTrwa(true);
    setBlad(null);
    try {
      const odp = await fetch("/api/skrzynka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          haslo,
          nazwa,
          host: inny ? host : "",
          port: inny ? port : "",
        }),
      });
      const dane = await odp.json();
      if (!odp.ok) return setBlad(dane.blad ?? t("skrzynka.niePodlaczono"));
      await onNowa(dane.id);
    } catch {
      setBlad(t("skrzynka.niePodlaczono"));
    } finally {
      setTrwa(false);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-slate-500">
        {t("skrzynka.opis1")} <b>{t("skrzynka.opis.haslo")}</b> {t("skrzynka.opis2")}
      </p>

      {lista.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">{t("skrzynka.uzyjWczesniej")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lista.map((s) => (
              <button
                key={s.id}
                onClick={() => onWybierz(s.id)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-900"
              >
                {s.email_nadawcy}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">{t("skrzynka.alboNowa")}</p>
        </div>
      )}

      <form onSubmit={podlacz} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={pole}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("skrzynka.ph.adres")}
          />
          <input
            className={pole}
            type="password"
            required
            value={haslo}
            onChange={(e) => setHaslo(e.target.value)}
            placeholder={t("skrzynka.ph.haslo")}
            autoComplete="new-password"
          />
        </div>
        <input
          className={pole}
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          placeholder={t("skrzynka.ph.nazwa")}
        />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={inny}
            onChange={(e) => setInny(e.target.checked)}
          />
          {t("skrzynka.innaPoczta")}
        </label>
        {inny && (
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <input
              className={pole}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t("skrzynka.ph.host")}
            />
            <input
              className={pole}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder={t("skrzynka.ph.port")}
            />
          </div>
        )}
        {blad && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {blad}
          </p>
        )}
        <button disabled={trwa} className={przycisk}>
          {trwa ? t("skrzynka.sprawdzamPolaczenie") : t("skrzynka.podlacz")}
        </button>
      </form>
    </div>
  );
}
