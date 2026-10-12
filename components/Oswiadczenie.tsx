"use client";

import { useEffect, useState } from "react";
import { POLE, PRZYCISK_DRUGI, PRZYCISK_GLOWNY } from "@/components/ui";
import type { Kampania } from "@/lib/types";
import { useT } from "@/lib/i18n/klient";
import {
  FORMY_PRAWNE,
  KRAJE_ODBIORCOW,
  OSWIADCZENIA,
  pusteOswiadczenie,
  RODZAJE_SPRAW,
  sprawdzOswiadczenie,
  wymagaNipKrs,
  ZGODA,
  ZRODLA_FINANSOWANIA,
  ZRODLA_Z_OPISEM,
  type KluczOswiadczenia,
  type KrajOdbiorcow,
  type RodzajSprawy,
  type TrescOswiadczenia,
  type ZrodloFinansowania,
} from "@/lib/oswiadczenie";
import type { WynikZgodnosci } from "@/lib/zgodnosc";

const pole = `mt-1.5 ${POLE}`;

type Zlozone = { tresc: TrescOswiadczenia; utworzone: string };

const KLASA_STATUSU: Record<WynikZgodnosci["status"], string> = {
  poza_zakresem: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  dozwolone_po_obowiazkach: "bg-sky-50 text-sky-800 ring-sky-200",
  zablokowane_do_uzupelnienia: "bg-amber-50 text-amber-800 ring-amber-200",
  niedozwolone_lub_prawnik: "bg-red-50 text-red-800 ring-red-200",
};

/**
 * Kto zleca kampanię (punkt 1 Piotra, 07.10): zleceniodawca, źródło finansowania, oświadczenia.
 * Bez tego i bez akceptacji zespołu nie rusza ani ręczna, ani automatyczna wysyłka (lib/wysylka-serwer).
 * Oświadczenie jest append-only: poprawka = nowy wiersz, decyzja zespołu wraca na "czeka".
 * Wartości (forma prawna, źródło finansowania) idą do bazy po polsku; etykiety z t().
 */
export function Oswiadczenie({ k, onZmiana }: { k: Kampania; onZmiana: (k: Kampania) => void }) {
  const { t: tl } = useT();
  const [zlozone, setZlozone] = useState<Zlozone | null | undefined>(undefined);
  const [edycja, setEdycja] = useState(false);
  const [t, setT] = useState<TrescOswiadczenia>(pusteOswiadczenie());
  const [powod, setPowod] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  // Decyzję widzi i podejmuje tylko administrator WinOver (opcja 3, 12.10); klient widzi status.
  const [jestAdmin, setJestAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/ja")
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => setJestAdmin(Boolean(d?.admin)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let aktualny = true;
    fetch(`/api/kampanie/${k.id}/oswiadczenie`)
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => aktualny && setZlozone(d?.oswiadczenie ?? null))
      .catch(() => aktualny && setZlozone(null));
    return () => {
      aktualny = false;
    };
  }, [k.id]);

  const zm = <K extends keyof TrescOswiadczenia>(klucz: K, wartosc: TrescOswiadczenia[K]) =>
    setT((s) => ({ ...s, [klucz]: wartosc }));

  async function zloz(e: React.FormEvent) {
    e.preventDefault();
    const b = sprawdzOswiadczenie(t, tl);
    if (b) return setBlad(b);
    setBlad(null);
    setZapisuje(true);
    try {
      const odp = await fetch(`/api/kampanie/${k.id}/oswiadczenie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? tl("wspolne.nieZapisano"));
      setZlozone({ tresc: { ...t, zgodnosc: d.zgodnosc }, utworzone: new Date().toISOString() });
      setEdycja(false);
      const auto = d.zgoda === "zaakceptowana";
      onZmiana({
        ...k,
        zgodaZespolu: auto ? "zaakceptowana" : "czeka",
        zgodaPowod: d.powod ?? "",
        zgodaKiedy: auto ? new Date().toISOString() : null,
      });
    } catch {
      setBlad(tl("wspolne.nieZapisano"));
    } finally {
      setZapisuje(false);
    }
  }

  const wynik = zlozone?.tresc.zgodnosc ?? null;
  const akceptacjaZPowodem = wynik?.status === "niedozwolone_lub_prawnik";

  async function decyzja(zgoda: "zaakceptowana" | "odrzucona") {
    if (zgoda === "odrzucona" && !powod.trim()) return setBlad(tl("osw.podajPowod"));
    if (zgoda === "zaakceptowana" && akceptacjaZPowodem && !powod.trim()) return setBlad(tl("osw.akceptujaPowod"));
    setBlad(null);
    setZapisuje(true);
    try {
      const odp = await fetch(`/api/kampanie/${k.id}/oswiadczenie`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zgoda, powod }),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? tl("osw.nieZapisanoDecyzji"));
      onZmiana({ ...k, zgodaZespolu: zgoda, zgodaPowod: powod.trim(), zgodaKiedy: new Date().toISOString() });
    } catch {
      setBlad(tl("osw.nieZapisanoDecyzji"));
    } finally {
      setZapisuje(false);
    }
  }

  const zgoda = k.zgodaZespolu ? ZGODA[k.zgodaZespolu] : null;
  const formularz = edycja || zlozone === null;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{tl("osw.tytul")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{tl("osw.opis")}</p>
        </div>
        {zgoda && k.zgodaZespolu && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${zgoda.klasa}`}>
            {tl(`zgoda.${k.zgodaZespolu}`)}
          </span>
        )}
      </div>

      {zlozone === undefined && <p className="mt-4 text-sm text-slate-400">{tl("wspolne.wczytuje")}</p>}

      {zlozone && !edycja && (
        <div className="mt-5">
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Poz
              etykieta={tl("osw.zleceniodawca")}
              wartosc={`${zlozone.tresc.zleceniodawca} (${tl(`formaPrawna.${zlozone.tresc.formaPrawna}`)}, ${zlozone.tresc.kraj})`}
            />
            <Poz etykieta={tl("osw.osoba")} wartosc={`${zlozone.tresc.osoba}, ${zlozone.tresc.email}`} />
            <Poz
              etykieta={tl("osw.rola")}
              wartosc={
                zlozone.tresc.rola === "wlasne"
                  ? tl("osw.wlasne")
                  : tl("osw.naZlecenie", { kto: zlozone.tresc.naZlecenieKogo })
              }
            />
            <Poz
              etykieta={tl("osw.zrodlo")}
              wartosc={`${tl(`zrodloFin.${zlozone.tresc.zrodlo}`)}${zlozone.tresc.zrodloOpis ? `: ${zlozone.tresc.zrodloOpis}` : ""}`}
            />
            {zlozone.tresc.nipKrs && <Poz etykieta={tl("osw.nipKrs")} wartosc={zlozone.tresc.nipKrs} />}
            {zlozone.tresc.rodzajSprawy && (
              <Poz
                etykieta={tl("osw.rodzajSprawy")}
                wartosc={`${tl(`rodzajSprawy.${zlozone.tresc.rodzajSprawy}`)}${zlozone.tresc.wybory === "tak" ? `, ${tl("osw.wyboryInfo", { data: zlozone.tresc.wyboryData ?? "" })}` : ""}`}
              />
            )}
            {zlozone.tresc.krajOdbiorcow && (
              <Poz etykieta={tl("osw.odbiorcy")} wartosc={tl(`krajOdbiorcow.${zlozone.tresc.krajOdbiorcow}`)} />
            )}
            <Poz etykieta={tl("osw.zlozone")} wartosc={new Date(zlozone.utworzone).toLocaleString(tl.locale)} />
          </dl>

          {wynik && (
            <div className="mt-5 rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{tl("osw.zgodnosc")}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${KLASA_STATUSU[wynik.status]}`}>
                  {tl(`zgodnosc.${wynik.status}`)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{tl("osw.zgodnosc.opis")}</p>
              {wynik.powody.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-slate-500">{tl("osw.powody")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {wynik.powody.map((p) => (
                      <li key={p}>{tl(`powod.${p}`)}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs font-medium text-slate-500">{tl("osw.obowiazki")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {wynik.obowiazki.map((o) => (
                  <li key={o}>{tl(`obowiazek.${o}`)}</li>
                ))}
              </ul>
            </div>
          )}
          {k.zgodaZespolu === "odrzucona" && k.zgodaPowod && (
            <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-800 ring-1 ring-red-100">
              {tl("osw.powodOdrzucenia", { powod: k.zgodaPowod })}
            </p>
          )}

          {k.zgodaZespolu === "zaakceptowana" && k.zgodaPowod && (
            <p className="mt-4 text-sm text-slate-600">{tl("osw.powodDecyzji", { powod: k.zgodaPowod })}</p>
          )}

          {k.zgodaZespolu === "czeka" && !jestAdmin && (
            <p className="mt-5 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
              {tl("osw.czekaNaWinOver")}
            </p>
          )}

          {k.zgodaZespolu === "czeka" && jestAdmin && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-800">{tl("osw.decyzja")}</p>
              <p className="mt-1 text-sm text-slate-600">{tl("osw.decyzja.opis")}</p>
              {akceptacjaZPowodem && <p className="mt-1 text-sm text-red-700">{tl("osw.akceptujaPowod")}</p>}
              <input
                className={pole}
                value={powod}
                onChange={(e) => setPowod(e.target.value)}
                placeholder={tl("osw.powod.ph")}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" disabled={zapisuje} onClick={() => decyzja("zaakceptowana")} className={PRZYCISK_GLOWNY}>
                  {tl("osw.akceptuje")}
                </button>
                <button type="button" disabled={zapisuje} onClick={() => decyzja("odrzucona")} className={PRZYCISK_DRUGI}>
                  {tl("osw.odrzucam")}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setT(zlozone.tresc);
              setEdycja(true);
            }}
            className="mt-4 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
          >
            {tl("osw.zlozNowe")}
          </button>
        </div>
      )}

      {formularz && zlozone !== undefined && (
        <form onSubmit={zloz} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.zleceniodawca")}</span>
              <input className={pole} value={t.zleceniodawca} onChange={(e) => zm("zleceniodawca", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.forma")}</span>
              <select className={pole} value={t.formaPrawna} onChange={(e) => zm("formaPrawna", e.target.value as TrescOswiadczenia["formaPrawna"])}>
                {FORMY_PRAWNE.map((f) => (
                  <option key={f} value={f}>
                    {tl(`formaPrawna.${f}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.kraj")}</span>
              <input className={pole} value={t.kraj} onChange={(e) => zm("kraj", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {wymagaNipKrs(t) ? `${tl("osw.nipKrs")} ${tl("osw.f.wymagany")}` : tl("osw.f.nipKrs")}
              </span>
              <input className={pole} value={t.nipKrs} onChange={(e) => zm("nipKrs", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.osoba")}</span>
              <input className={pole} value={t.osoba} onChange={(e) => zm("osoba", e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.email")}</span>
              <input className={pole} type="email" value={t.email} onChange={(e) => zm("email", e.target.value)} />
            </label>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-slate-500">{tl("osw.f.rola")}</legend>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={t.rola === "wlasne"} onChange={() => zm("rola", "wlasne")} />
                {tl("osw.f.wlasne")}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={t.rola === "zlecenie"} onChange={() => zm("rola", "zlecenie")} />
                {tl("osw.f.zlecenie")}
              </label>
              {t.rola === "zlecenie" && (
                <input className={POLE} value={t.naZlecenieKogo} onChange={(e) => zm("naZlecenieKogo", e.target.value)} placeholder={tl("osw.f.naCzyje")} />
              )}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.zrodlo")}</span>
              <select className={pole} value={t.zrodlo} onChange={(e) => zm("zrodlo", e.target.value as ZrodloFinansowania)}>
                {(Object.keys(ZRODLA_FINANSOWANIA) as ZrodloFinansowania[]).map((z) => (
                  <option key={z} value={z}>
                    {tl(`zrodloFin.${z}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {tl("osw.f.opis")}{" "}
                {ZRODLA_Z_OPISEM.includes(t.zrodlo) || t.rola === "zlecenie" ? tl("osw.f.wymagany") : tl("osw.f.opcjonalnie")}
              </span>
              <input className={pole} value={t.zrodloOpis} onChange={(e) => zm("zrodloOpis", e.target.value)} placeholder={tl("osw.f.opis.ph")} />
            </label>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-xs font-medium text-slate-500">{tl("osw.f.sprawa")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{tl("osw.f.rodzaj")}</span>
                <select className={pole} value={t.rodzajSprawy ?? "ustawa"} onChange={(e) => zm("rodzajSprawy", e.target.value as RodzajSprawy)}>
                  {RODZAJE_SPRAW.map((r) => (
                    <option key={r} value={r}>
                      {tl(`rodzajSprawy.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">{tl("osw.f.krajOdbiorcow")}</span>
                <select className={pole} value={t.krajOdbiorcow ?? "pl"} onChange={(e) => zm("krajOdbiorcow", e.target.value as KrajOdbiorcow)}>
                  {KRAJE_ODBIORCOW.map((kr) => (
                    <option key={kr} value={kr}>
                      {tl(`krajOdbiorcow.${kr}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">{tl("osw.f.wybory")}</span>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={t.wybory !== "tak"} onChange={() => zm("wybory", "nie")} />
                  {tl("osw.f.wybory.nie")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={t.wybory === "tak"} onChange={() => zm("wybory", "tak")} />
                  {tl("osw.f.wybory.tak")}
                </label>
                {t.wybory === "tak" && (
                  <input type="date" className={`${POLE} w-auto`} value={t.wyboryData ?? ""} onChange={(e) => zm("wyboryData", e.target.value)} />
                )}
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={t.siedzibaPozaUE === true} onChange={(e) => zm("siedzibaPozaUE", e.target.checked)} />
              <span>{tl("osw.f.siedzibaPozaUE")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={t.platneNaRzeczTrzeciego === true} onChange={(e) => zm("platneNaRzeczTrzeciego", e.target.checked)} />
              <span>{tl("osw.f.platne")}</span>
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium text-slate-500">{tl("osw.f.oswiadczenia")}</legend>
            {(Object.keys(OSWIADCZENIA) as KluczOswiadczenia[]).map((klucz) => (
              <label key={klucz} className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={t.potwierdzenia[klucz]}
                  onChange={(e) => zm("potwierdzenia", { ...t.potwierdzenia, [klucz]: e.target.checked })}
                />
                <span>{tl(`osw.tekst.${klucz}`)}</span>
              </label>
            ))}
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={t.zgodaStopka === true} onChange={(e) => zm("zgodaStopka", e.target.checked)} />
              <span>{tl("osw.f.stopka")}</span>
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button disabled={zapisuje} className={PRZYCISK_GLOWNY}>
              {zapisuje ? tl("osw.zapisuje") : tl("osw.skladam")}
            </button>
            {zlozone && (
              <button type="button" onClick={() => setEdycja(false)} className={PRZYCISK_DRUGI}>
                {tl("wspolne.anuluj")}
              </button>
            )}
          </div>
        </form>
      )}

      {blad && <p className="mt-3 text-sm text-red-700">{blad}</p>}
    </section>
  );
}

function Poz({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{etykieta}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{wartosc}</dd>
    </div>
  );
}
