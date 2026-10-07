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
    if (!POPRAWNY_SLUG.test(s))
      return setBlad("Adres strony: małe litery, cyfry i myślniki, 2-60 znaków.");
    if (wlaczona && !tytul.trim())
      return setBlad("Strona potrzebuje tytułu, zanim ją włączysz.");
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
      setBlad(
        String(e).includes("duplicate")
          ? "Ten adres strony jest już zajęty przez inną kampanię."
          : "Nie udało się zapisać.",
      );
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
      if (!odp.ok) return setBlad(dane.blad ?? "Nie udało się wygenerować wiadomości.");
      await wczytaj();
    } catch {
      setBlad("Nie udało się wygenerować wiadomości.");
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
    { nazwa: "Lista odbiorców przygotowana (Wysyłka, krok 1)", ok: odbiorcy > 0 },
    { nazwa: "Co najmniej jedna wiadomość sympatyka zatwierdzona", ok: zatwierdzone > 0 },
    { nazwa: "Strona włączona i zapisana", ok: k.akcjaWlaczona && !!k.akcjaSlug },
  ];

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Strona akcji dla sympatyków
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Publiczna strona, na której mieszkaniec podaje imię i gminę, dostaje
            gotową wiadomość do swojego posła albo urzędu i wysyła ją sam ze swojej
            poczty. Liczymy podpisy i kliknięcia „Otwórz w poczcie”.
          </p>
        </div>
        {adres && k.akcjaWlaczona && (
          <div className="flex items-center gap-2">
            <a
              href={adres}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900"
            >
              Otwórz stronę
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
              {skopiowano ? "Skopiowano" : "Kopiuj link"}
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

      {podpisy && (podpisy.razem > 0 || k.akcjaWlaczona) && (
        <dl className="mt-5 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
          {[
            ["Podpisów", podpisy.razem],
            ["Otworzyło pocztę", podpisy.otworzyli],
            ["Udostępniło", podpisy.udostepnili],
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
          <span className="text-sm font-medium text-slate-700">Tytuł strony</span>
          <input
            className={pole}
            value={tytul}
            onChange={(e) => setTytul(e.target.value)}
            placeholder="np. Zatrzymajmy likwidację linii 12"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">O co chodzi (dla mieszkańców)</span>
          <textarea
            className={`${pole} min-h-32 resize-y`}
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            placeholder="Prostym językiem: co się dzieje, dlaczego to ważne, co może zrobić poseł. Akapity oddziel pustą linią."
          />
          <span className="mt-1 block text-xs text-slate-500">
            Film albo strona z briefu kampanii pojawi się nad opisem.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Adres strony</span>
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
          <span className="text-sm font-medium text-slate-700">Administrator danych (RODO)</span>
          <input
            className={pole}
            value={administrator}
            onChange={(e) => setAdministrator(e.target.value)}
            placeholder="np. Fundacja X, ul. Y 1, Warszawa, kontakt@x.pl"
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
            <span className="font-medium text-slate-700">Strona włączona</span>
            <span className="block text-slate-500">
              Wyłączona strona pokazuje „nie ma takiej akcji”. Podpisy zostają.
            </span>
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
          {zapisuje ? "Zapisuję..." : "Zapisz stronę"}
        </button>
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-slate-900">Wiadomości sympatyków</h3>
            <p className="mt-1 text-sm text-slate-600">
              Pisane jak od mieszkańca, w pierwszej osobie, z polem {"{gmina}"}.
              Każdy sympatyk dostaje losowo jeden z zatwierdzonych wariantów i może
              go zmienić. Zatwierdzone{" "}
              <span className="font-semibold text-slate-900">{zatwierdzone}</span> z{" "}
              {aktywne.length}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                aktywne.length &&
                !window.confirm("Nowe wiadomości zastąpią niezatwierdzone szkice. Wygenerować?")
              )
                return;
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
              ? "Piszę wiadomości (ok. 1-2 min)..."
              : aktywne.length
                ? "Wygeneruj ponownie"
                : "Wygeneruj wiadomości sympatyków"}
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
          <h3 className="font-medium text-slate-900">Ostatnie podpisy</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-4 font-medium">Kto</th>
                  <th className="py-2 pr-4 font-medium">Gmina</th>
                  <th className="py-2 pr-4 font-medium">Do kogo</th>
                  <th className="py-2 pr-4 font-medium">Kiedy</th>
                  <th className="py-2 font-medium">Poczta</th>
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
                      {new Date(p.utworzony).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 text-slate-600">{p.otworzylPoczte ? "otworzył" : ""}</td>
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
