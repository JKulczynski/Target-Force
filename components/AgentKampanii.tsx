"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dodajKampanie } from "@/lib/store";
import { pustaKampania, type ZrodloId } from "@/lib/types";
import { useT } from "@/lib/i18n/klient";

type Krok = { id: (typeof KROKI)[number]; stan: "czeka" | "trwa" | "ok" | "pominiety" | "blad"; info?: string };
const KROKI = ["czytam", "odbiorcy", "zapis", "lista", "ustawa", "glosowanie", "wiadomosci"] as const;

/**
 * Agent WinOver (14.10): z linku albo kilku zdań składa szkic kampanii istniejącymi klockami:
 * brief (/api/agent/szkic), propozycja odbiorców, zapis, lista odbiorców, ustawa i projekty zmian,
 * głosowanie jako argument, wiadomości. Wszystko jest szkicem: nic nie wychodzi bez akceptacji
 * i oświadczenia zleceniodawcy. Kroki po zapisie są nieobowiązkowe: błąd jednego nie zatrzymuje reszty.
 */
export function AgentKampanii() {
  const { t } = useT();
  const router = useRouter();
  const [wejscie, setWejscie] = useState("");
  const [kroki, setKroki] = useState<Krok[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [brakuje, setBrakuje] = useState("");

  const ustaw = (id: Krok["id"], stan: Krok["stan"], info?: string) =>
    setKroki((k) => (k ?? []).map((x) => (x.id === id ? { ...x, stan, info } : x)));

  async function json(url: string, init?: RequestInit) {
    const o = await fetch(url, init);
    const d = await o.json().catch(() => ({}));
    if (!o.ok) throw new Error(d.blad ?? `HTTP ${o.status}`);
    return d;
  }
  const post = (url: string, body?: unknown) =>
    json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const put = (url: string, body: unknown) =>
    json(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function zbuduj() {
    setBlad(null);
    setBrakuje("");
    setKroki(KROKI.map((id) => ({ id, stan: "czeka" })));
    let id = "";
    try {
      ustaw("czytam", "trwa");
      const brief = await post("/api/agent/szkic", { wejscie });
      ustaw("czytam", "ok", brief.nazwa);
      setBrakuje(brief.brakuje ?? "");

      ustaw("odbiorcy", "trwa");
      const prop = await post("/api/kampanie/propozycja", { cel: brief.cel, materialy: brief.materialy, nazwa: brief.nazwa });
      ustaw("odbiorcy", "ok", prop.kogoSzukamy);

      ustaw("zapis", "trwa");
      const k = await dodajKampanie({
        ...pustaKampania(),
        nazwa: brief.nazwa,
        cel: brief.cel,
        materialy: brief.materialy,
        linkFilm: brief.linkFilm ?? "",
        zrodla: prop.zrodla as ZrodloId[],
        kogoSzukamy: prop.kogoSzukamy ?? "",
        filtrOdbiorcow: { komisje: (prop.komisje ?? []).map((x: { kod: string }) => x.kod) },
      });
      id = k.id;
      ustaw("zapis", "ok");
    } catch (e) {
      setKroki((k) => (k ?? []).map((x) => (x.stan === "trwa" ? { ...x, stan: "blad", info: (e as Error).message } : x)));
      setBlad((e as Error).message);
      return;
    }

    // Kroki nieobowiązkowe: każdy osobno, błąd nie zatrzymuje kolejnych.
    const krok = async (nazwa: Krok["id"], fn: () => Promise<string | null>) => {
      ustaw(nazwa, "trwa");
      try {
        const info = await fn();
        ustaw(nazwa, info === null ? "pominiety" : "ok", info ?? undefined);
      } catch (e) {
        ustaw(nazwa, "blad", (e as Error).message);
      }
    };
    await krok("lista", async () => {
      const d = await post(`/api/kampanie/${id}/wysylka`, { tryb: "odbiorcy" });
      return t("agent.dodano", { n: d.dodane ?? 0 });
    });
    await krok("ustawa", async () => {
      const d = await post(`/api/kampanie/${id}/ustawa`);
      const u = d.kandydaci?.[0];
      if (!u) return null;
      await put(`/api/kampanie/${id}/ustawa`, { ustawa: u });
      return u.tytul;
    });
    await krok("glosowanie", async () => {
      const d = await post(`/api/kampanie/${id}/glosowania`);
      const g = d.propozycje?.[0];
      if (!g) return null;
      await put(`/api/kampanie/${id}/glosowania`, { glosowanie: g });
      return `${g.data}: ${g.za}`;
    });
    await krok("wiadomosci", async () => {
      await post(`/api/kampanie/${id}/generuj`);
      return "";
    });
    router.push(`/kampanie/${id}`);
  }

  const znak = { czeka: "○", trwa: "…", ok: "✓", pominiety: "–", blad: "!" } as const;
  const kolor = { czeka: "text-slate-400", trwa: "text-brand-700", ok: "text-emerald-700", pominiety: "text-slate-400", blad: "text-red-700" } as const;

  return (
    <section className="mb-8 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("agent.tytul")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("agent.opis")}</p>
      <textarea
        className="mt-3 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm"
        value={wejscie}
        onChange={(e) => setWejscie(e.target.value)}
        placeholder={t("agent.ph")}
        disabled={!!kroki && !blad}
      />
      <button
        type="button"
        onClick={zbuduj}
        disabled={wejscie.trim().length < 10 || (!!kroki && !blad)}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-300"
      >
        {t("agent.zbuduj")}
      </button>
      {kroki && (
        <ol className="mt-4 space-y-1.5 text-sm">
          {kroki.map((k) => (
            <li key={k.id} className={kolor[k.stan]}>
              <span className="inline-block w-5 font-mono">{znak[k.stan]}</span>
              {t(`agent.krok.${k.id}`)}
              {k.info && <span className="text-slate-500"> · {k.info}</span>}
            </li>
          ))}
        </ol>
      )}
      {brakuje && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t("agent.brakuje")}: {brakuje}</p>}
      {blad && <p className="mt-2 text-sm text-red-700">{blad}</p>}
      <p className="mt-3 text-xs text-slate-500">{t("agent.uwaga")}</p>
    </section>
  );
}
