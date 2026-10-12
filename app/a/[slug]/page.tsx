import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AkcjaFormularz } from "@/components/AkcjaFormularz";
import { WidokAkcji } from "@/components/WidokAkcji";
import { oczyscWyglad, type WygladAkcji } from "@/lib/wyglad";
import { tlumacz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";
import type { TrescOswiadczenia } from "@/lib/oswiadczenie";

export const dynamic = "force-dynamic";

/**
 * Publiczna strona akcji (wariant A, 07.10): mieszkaniec czyta o sprawie, podaje imię i gminę,
 * dostaje gotową wiadomość do swojego posła albo urzędu i wysyła ją sam ze swojej poczty.
 * Dane czyta klient serwisowy (strona jest bez logowania), ale tylko pola oznaczone jako publiczne.
 * Interfejs w języku z cookie (przełącznik w layoucie publicznym); treść strony i wiadomości są takie, jak wpisał nadawca.
 */
type Akcja = {
  tytul: string;
  opis: string;
  nadawca: string;
  administrator: string;
  film: string;
  podpisy: number;
  gotowa: boolean;
  wyglad: WygladAkcji;
  /** Z zaakceptowanego oświadczenia zleceniodawcy; null, gdy go nie ma. */
  prowadzi: {
    zleceniodawca: string;
    forma: TrescOswiadczenia["formaPrawna"];
    zrodlo: TrescOswiadczenia["zrodlo"];
    zrodloOpis: string;
    naZlecenie: string;
  } | null;
};

async function akcja(slug: string, domyslnyTytul: string): Promise<Akcja | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: k } = await admin
    .from("kampanie")
    .select(
      "id, nadawca, link_film, akcja_wlaczona, akcja_tytul, akcja_opis, akcja_administrator, zgoda_zespolu, akcja_wyglad",
    )
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k || !k.akcja_wlaczona) return null;
  const [{ count: podpisy }, { count: warianty }, { count: odbiorcy }, { data: osw }] =
    await Promise.all([
      admin
        .from("podpisy")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id),
      admin
        .from("warianty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id)
        .eq("rola", "sympatyk")
        .eq("status", "zatwierdzony"),
      admin
        .from("kontakty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id)
        .eq("wypisany", false)
        .not("email", "is", null),
      // Stopka "Kampanię prowadzi ..." (legal etap 1): tylko gdy zespół zaakceptował oświadczenie.
      k.zgoda_zespolu === "zaakceptowana"
        ? admin
            .from("oswiadczenia")
            .select("tresc")
            .eq("kampania_id", k.id)
            .order("utworzone", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const o = (osw?.tresc ?? null) as TrescOswiadczenia | null;
  return {
    prowadzi: o
      ? {
          zleceniodawca: o.zleceniodawca,
          forma: o.formaPrawna,
          zrodlo: o.zrodlo,
          zrodloOpis: o.zrodloOpis,
          naZlecenie: o.rola === "zlecenie" ? o.naZlecenieKogo : "",
        }
      : null,
    tytul: String(k.akcja_tytul || domyslnyTytul),
    opis: String(k.akcja_opis ?? ""),
    nadawca: String(k.nadawca ?? ""),
    administrator: String(k.akcja_administrator || k.nadawca || ""),
    film: String(k.link_film ?? ""),
    podpisy: podpisy ?? 0,
    gotowa: (warianty ?? 0) > 0 && (odbiorcy ?? 0) > 0,
    wyglad: oczyscWyglad(k.akcja_wyglad),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = tlumacz(await jezykZCookie());
  const a = await akcja(slug, t("akcja.domyslnyTytul"));
  if (!a) return { title: t("akcja.nieMaAkcji") };
  return {
    title: a.tytul,
    description: a.opis.split("\n")[0]?.slice(0, 160),
    robots: { index: true, follow: true },
  };
}

export default async function StronaAkcjiPubliczna({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = tlumacz(await jezykZCookie());
  const a = await akcja(slug, t("akcja.domyslnyTytul"));
  if (!a) notFound();
  const prowadzi = a.prowadzi
    ? `${t("akcja.prowadzi", {
        zleceniodawca: a.prowadzi.zleceniodawca,
        forma: t(`formaPrawna.${a.prowadzi.forma}`),
        zrodlo: `${t(`zrodloFin.${a.prowadzi.zrodlo}`)}${a.prowadzi.zrodloOpis ? `: ${a.prowadzi.zrodloOpis}` : ""}`,
      })}${a.prowadzi.naZlecenie ? ` ${t("stopka.naZlecenie", { kto: a.prowadzi.naZlecenie })}` : ""}`
    : "";

  return (
    <WidokAkcji
      nadawca={a.nadawca}
      tytul={a.tytul}
      opis={a.opis}
      film={a.film}
      prowadzi={prowadzi}
      wyglad={a.wyglad}
      formularz={
        <AkcjaFormularz
          slug={slug}
          razem={a.podpisy}
          gotowa={a.gotowa}
          administrator={a.administrator}
          cel={a.wyglad.cel}
          przycisk={a.wyglad.przycisk}
          dziekujemy={a.wyglad.dziekujemy}
        />
      }
    />
  );
}
