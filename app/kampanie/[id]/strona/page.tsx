"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { POLE, PRZYCISK_DRUGI, PRZYCISK_GLOWNY } from "@/components/ui";
import { PasekCelu, WidokAkcji } from "@/components/WidokAkcji";
import { doPoslow } from "@/lib/akcja";
import { kampania, zmienKampanie } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { POPRAWNY_SLUG, slugZNazwy } from "@/lib/akcja";
import { oczyscWyglad, UKLADY, type WygladAkcji } from "@/lib/wyglad";
import type { Kampania } from "@/lib/types";
import { useT } from "@/lib/i18n/klient";

const pole = `mt-1.5 ${POLE}`;

/**
 * Kreator strony akcji (12.10, plan "strona akcji jako serce produktu"): formularz po lewej, podgląd na żywo
 * po prawej (telefon albo komputer), ten sam widok co strona publiczna. Zdjęcia i logo do magazynu Supabase
 * (folder = id kampanii, zapis tylko z dostępem do kampanii).
 */
export default function KreatorStrony() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [tytul, setTytul] = useState("");
  const [opis, setOpis] = useState("");
  const [film, setFilm] = useState("");
  const [slug, setSlug] = useState("");
  const [administrator, setAdministrator] = useState("");
  const [wlaczona, setWlaczona] = useState(false);
  const [w, setW] = useState<WygladAkcji>({});
  const [widok, setWidok] = useState<"telefon" | "komputer">("telefon");
  const [zapisuje, setZapisuje] = useState(false);
  const [wgrywa, setWgrywa] = useState<"obraz" | "logo" | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let aktualny = true;
    kampania(id)
      .then((x) => {
        if (!aktualny) return;
        setK(x ?? null);
        if (!x) return;
        setTytul(x.akcjaTytul || x.nazwa);
        setOpis(x.akcjaOpis);
        setFilm(x.linkFilm);
        setSlug(x.akcjaSlug ?? slugZNazwy(x.nazwa));
        setAdministrator(x.akcjaAdministrator || x.nadawca);
        setWlaczona(x.akcjaWlaczona);
        setW(oczyscWyglad(x.akcjaWyglad));
      })
      .catch(() => aktualny && setK(null));
    return () => {
      aktualny = false;
    };
  }, [id]);

  const zw = <K extends keyof WygladAkcji>(klucz: K, v: WygladAkcji[K]) => {
    setW((s) => ({ ...s, [klucz]: v }));
    setInfo(null);
  };

  async function wgraj(rodzaj: "obraz" | "logo", plik: File | undefined) {
    if (!plik || !k) return;
    if (plik.size > 5 * 1024 * 1024) return setBlad(t("strona.zaDuzy"));
    setBlad(null);
    setWgrywa(rodzaj);
    try {
      const supabase = createClient();
      const rozszerzenie = (plik.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const sciezka = `${k.id}/${rodzaj}-${Date.now()}.${rozszerzenie}`;
      const { error } = await supabase.storage.from("akcja").upload(sciezka, plik, { contentType: plik.type, upsert: false });
      if (error) return setBlad(t("strona.bladWgrania"));
      const { data } = supabase.storage.from("akcja").getPublicUrl(sciezka);
      zw(rodzaj, data.publicUrl);
    } finally {
      setWgrywa(null);
    }
  }

  async function zapisz() {
    if (!k) return;
    setBlad(null);
    setInfo(null);
    const s = slug.trim();
    if (!POPRAWNY_SLUG.test(s)) return setBlad(t("akcjaPanel.bladSlug"));
    if (wlaczona && !tytul.trim()) return setBlad(t("akcjaPanel.bladTytul"));
    setZapisuje(true);
    try {
      const nowa = await zmienKampanie(k.id, {
        akcjaTytul: tytul.trim(),
        akcjaOpis: opis.trim(),
        linkFilm: film.trim(),
        akcjaSlug: s,
        akcjaAdministrator: administrator.trim(),
        akcjaWlaczona: wlaczona,
        akcjaWyglad: oczyscWyglad(w),
      });
      if (nowa) setK(nowa);
      setInfo(t("strona.zapisano"));
    } catch (e) {
      setBlad(String(e).includes("duplicate") ? t("akcjaPanel.slugZajety") : t("wspolne.nieZapisano"));
    } finally {
      setZapisuje(false);
    }
  }

  if (k === undefined) return <p className="text-sm text-slate-400">{t("wspolne.wczytuje")}</p>;
  if (k === null) return <p className="text-sm text-slate-600">{t("api.nieZnalezionoKampanii")}</p>;

  const atrapa = (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">0</span> {t.n("akcja.juzNapisalo", 0)}
      </p>
      {w.cel && <PasekCelu razem={0} cel={w.cel} />}
      <h2 className="mt-5 text-lg font-semibold tracking-tight">{t(doPoslow(k.zrodla) ? "akcja.napiszDoPosla" : "akcja.napiszDoUrzedu")}</h2>
      <div className="mt-4 space-y-3" aria-hidden>
        {[t("akcja.imie"), t("akcja.nazwisko"), t("akcja.gmina"), t("akcja.email")].map((e) => (
          <div key={e}>
            <p className="text-sm font-medium text-slate-700">{e}</p>
            <div className="mt-1.5 h-10 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        ))}
        <div className="w-full rounded-lg bg-brand-600 px-5 py-3 text-center text-[15px] font-medium text-white">
          {w.przycisk || t("akcja.przygotuj")}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <Link href={`/kampanie/${k.id}#akcja`} className="text-sm text-slate-500 hover:text-slate-900">
        {t("strona.wroc")}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("strona.tytul")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("strona.opis")}</p>
        </div>
        <div className="flex items-center gap-3">
          {k.akcjaWlaczona && k.akcjaSlug && (
            <a href={`/a/${k.akcjaSlug}`} target="_blank" rel="noreferrer" className={PRZYCISK_DRUGI}>
              {t("akcjaPanel.otworz")}
            </a>
          )}
          <button type="button" onClick={zapisz} disabled={zapisuje} className={PRZYCISK_GLOWNY}>
            {zapisuje ? t("akcjaPanel.zapisuje") : t("akcjaPanel.zapiszStrone")}
          </button>
        </div>
      </div>
      {(blad || info) && (
        <p className={`mt-3 text-sm ${blad ? "text-red-700" : "text-emerald-700"}`}>{blad ?? info}</p>
      )}

      <div className="mt-6 grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-5">
          <Grupa tytul={t("strona.g.tresc")}>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("akcjaPanel.tytulStrony")}</span>
              <input className={pole} value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder={t("akcjaPanel.tytulStrony.ph")} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("akcjaPanel.oCoChodzi")}</span>
              <textarea className={`${pole} min-h-40 resize-y`} value={opis} onChange={(e) => setOpis(e.target.value)} placeholder={t("akcjaPanel.oCoChodzi.ph")} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("strona.film")}</span>
              <input className={pole} value={film} onChange={(e) => setFilm(e.target.value)} placeholder="https://youtube.com/..." />
            </label>
          </Grupa>

          <Grupa tytul={t("strona.g.wyglad")}>
            <Plik
              etykieta={t("strona.obraz")}
              url={w.obraz}
              wgrywa={wgrywa === "obraz"}
              onPlik={(f) => wgraj("obraz", f)}
              onUsun={() => zw("obraz", undefined)}
            />
            <fieldset>
              <legend className="text-xs font-medium text-slate-500">{t("strona.uklad")}</legend>
              <div className="mt-1.5 flex gap-4 text-sm">
                {UKLADY.map((u) => (
                  <label key={u} className="flex items-center gap-2">
                    <input type="radio" checked={(w.uklad ?? "klasyczny") === u} onChange={() => zw("uklad", u)} />
                    {t(`strona.uklad.${u}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Plik
              etykieta={t("strona.logo")}
              url={w.logo}
              wgrywa={wgrywa === "logo"}
              onPlik={(f) => wgraj("logo", f)}
              onUsun={() => zw("logo", undefined)}
            />
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("strona.kolor")}</span>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded border border-slate-300"
                  value={w.kolor ?? "#b0306a"}
                  onChange={(e) => zw("kolor", e.target.value)}
                />
                {w.kolor && (
                  <button type="button" className="text-sm text-slate-500 hover:text-slate-900" onClick={() => zw("kolor", undefined)}>
                    {t("strona.kolorDomyslny")}
                  </button>
                )}
              </div>
            </label>
          </Grupa>

          <Grupa tytul={t("strona.g.formularz")}>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("strona.cel")}</span>
              <input
                className={pole}
                type="number"
                min={1}
                value={w.cel ?? ""}
                onChange={(e) => zw("cel", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("strona.przycisk")}</span>
              <input className={pole} maxLength={60} value={w.przycisk ?? ""} onChange={(e) => zw("przycisk", e.target.value || undefined)} placeholder={t("akcja.przygotuj")} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("strona.dziekujemy")}</span>
              <textarea
                className={`${pole} min-h-24 resize-y`}
                maxLength={600}
                value={w.dziekujemy ?? ""}
                onChange={(e) => zw("dziekujemy", e.target.value || undefined)}
                placeholder={t("akcja.dziekujemy.opis")}
              />
            </label>
          </Grupa>

          <Grupa tytul={t("strona.g.publikacja")}>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("akcjaPanel.adres")}</span>
              <div className="mt-1.5 flex items-center gap-1 text-sm text-slate-500">
                <span className="shrink-0">/a/</span>
                <input className={POLE} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("akcjaPanel.administrator")}</span>
              <input className={pole} value={administrator} onChange={(e) => setAdministrator(e.target.value)} placeholder={t("akcjaPanel.administrator.ph")} />
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={wlaczona} onChange={(e) => setWlaczona(e.target.checked)} />
              <span className="text-sm">
                <span className="font-medium text-slate-700">{t("akcjaPanel.wlaczona")}</span>
                <span className="block text-slate-500">{t("akcjaPanel.wlaczona.opis")}</span>
              </span>
            </label>
          </Grupa>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("strona.podglad")}</p>
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
              {(["telefon", "komputer"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWidok(v)}
                  className={`rounded-md px-3 py-1 ${widok === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  {t(`strona.widok.${v}`)}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 ${widok === "telefon" ? "mx-auto max-w-[400px]" : ""}`}
          >
            <WidokAkcji
              nadawca={k.nadawca}
              tytul={tytul || t("akcja.domyslnyTytul")}
              opis={opis}
              film={film}
              prowadzi=""
              wyglad={oczyscWyglad(w)}
              formularz={atrapa}
              waski={widok === "telefon"}
              doPoslow={doPoslow(k.zrodla)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Grupa({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{tytul}</h2>
      {children}
    </section>
  );
}

function Plik({
  etykieta,
  url,
  wgrywa,
  onPlik,
  onUsun,
}: {
  etykieta: string;
  url?: string;
  wgrywa: boolean;
  onPlik: (f: File | undefined) => void;
  onUsun: () => void;
}) {
  const { t } = useT();
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{etykieta}</p>
      <div className="mt-1.5 flex items-center gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura z magazynu Supabase
          <img src={url} alt="" className="h-12 w-16 rounded border border-slate-200 object-cover" />
        )}
        <label className="cursor-pointer rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
          {wgrywa ? t("strona.wgrywam") : url ? t("strona.zmien") : t("strona.wybierz")}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(e) => onPlik(e.target.files?.[0])} />
        </label>
        {url && (
          <button type="button" onClick={onUsun} className="text-sm text-slate-500 hover:text-slate-900">
            {t("strona.usun")}
          </button>
        )}
      </div>
    </div>
  );
}
