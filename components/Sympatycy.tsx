"use client";

import { useEffect, useState } from "react";
import { POLE, PRZYCISK_DRUGI, PRZYCISK_GLOWNY } from "@/components/ui";
import { ambasadorzy, eksportPodpisow, mailePrzeszle } from "@/lib/store";
import { useT } from "@/lib/i18n/klient";

/**
 * Praca z sympatykami (plan strony akcji, część 4, 12.10): kto przyprowadził najwięcej osób,
 * eksport CSV i mail do osób ze zgodą na kontakt (o wyniku albo kolejnym kroku).
 */
export function Sympatycy({ kampaniaId, nazwa, zgodyKontakt }: { kampaniaId: string; nazwa: string; zgodyKontakt: number }) {
  const { t } = useT();
  const [amb, setAmb] = useState<Awaited<ReturnType<typeof ambasadorzy>> | null>(null);
  const [historia, setHistoria] = useState<Awaited<ReturnType<typeof mailePrzeszle>>>([]);
  const [temat, setTemat] = useState("");
  const [tresc, setTresc] = useState("");
  const [wysyla, setWysyla] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualny = true;
    Promise.all([ambasadorzy(kampaniaId).catch(() => null), mailePrzeszle(kampaniaId).catch(() => [])]).then(([a, h]) => {
      if (!aktualny) return;
      setAmb(a);
      setHistoria(h);
    });
    return () => {
      aktualny = false;
    };
  }, [kampaniaId]);

  async function pobierz() {
    const csv = await eksportPodpisow(kampaniaId);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sympatycy-${nazwa.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(t("sympatycy.potwierdz", { n: zgodyKontakt }))) return;
    setWysyla(true);
    setBlad(null);
    setInfo(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/sympatycy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temat, tresc }),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? t("wspolne.nieZapisano"));
      setInfo(t(d.proba ? "sympatycy.wyslanoProba" : "sympatycy.wyslano", { n: d.wyslane }));
      setTemat("");
      setTresc("");
      setHistoria(await mailePrzeszle(kampaniaId).catch(() => historia));
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    } finally {
      setWysyla(false);
    }
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{t("sympatycy.tytul")}</h3>
          <p className="mt-1 text-sm text-slate-600">{t("sympatycy.opis")}</p>
        </div>
        <button type="button" onClick={pobierz} className={PRZYCISK_DRUGI}>
          {t("sympatycy.eksport")}
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-800">
          {t("sympatycy.zPolecen", { n: amb?.razem ?? 0 })}
        </p>
        {amb && amb.lista.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-slate-700">
            {amb.lista.map((a) => (
              <li key={a.nazwa}>
                {a.nazwa}: <span className="font-semibold tabular-nums">{a.ile}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-slate-500">{t("sympatycy.brakPolecen")}</p>
        )}
      </div>

      <form onSubmit={wyslij} className="mt-5 space-y-3">
        <p className="text-sm font-medium text-slate-800">{t("sympatycy.mail", { n: zgodyKontakt })}</p>
        <input className={POLE} value={temat} onChange={(e) => setTemat(e.target.value)} placeholder={t("sympatycy.temat.ph")} maxLength={200} />
        <textarea
          className={`${POLE} min-h-32 resize-y`}
          value={tresc}
          onChange={(e) => setTresc(e.target.value)}
          placeholder={t("sympatycy.tresc.ph")}
          maxLength={5000}
        />
        <p className="text-xs text-slate-500">{t("sympatycy.info")}</p>
        <button disabled={wysyla || zgodyKontakt === 0} className={PRZYCISK_GLOWNY}>
          {wysyla ? t("akcja.wysylam") : t("sympatycy.wyslij", { n: zgodyKontakt })}
        </button>
        {info && <p className="text-sm text-emerald-700">{info}</p>}
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </form>

      {historia.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-slate-500">
          {historia.map((h) => (
            <li key={h.wyslano}>
              {new Date(h.wyslano).toLocaleString(t.locale, { dateStyle: "short", timeStyle: "short" })} · {h.temat} ·{" "}
              {t("sympatycy.osob", { n: h.odbiorcow })}
              {h.proba && ` · ${t("sympatycy.proba")}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
