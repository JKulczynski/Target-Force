import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Agent WinOver, krok 1 (14.10, wzorzec Quorum Campaign Builder Agent): z linku (artykuł, projekt ustawy,
 * strona organizacji, film) albo z kilku zdań robi brief kampanii: nazwa, cel, fakty ze źródła, link do filmu.
 * Fakty tylko ze źródła. Dalsze kroki (odbiorcy, ustawa, głosowanie, wiadomości) robi klient istniejącymi API.
 */
const Brief = z.object({
  nazwa: z.string().describe("Krótka nazwa kampanii, do 60 znaków, po polsku."),
  cel: z
    .string()
    .describe("2-3 zdania: czego kampania chce od decydentów i dlaczego; konkretna prośba (np. poprawka, interpelacja, decyzja)."),
  materialy: z
    .string()
    .describe("Najważniejsze fakty ze źródła w punktach (liczby, daty, skutki, numery druków). Tylko to, co jest w źródle. Do 1500 znaków."),
  brakuje: z.string().describe("Czego brakuje do dobrej kampanii (np. kto jest nadawcą, lokalne liczby). Jedno-dwa zdania; pusty napis, jeśli niczego."),
});

const YT = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;

function bezpiecznyAdres(u: URL): boolean {
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  // Bez adresów wewnętrznych (SSRF): IP, localhost, domeny lokalne.
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
  return true;
}

/**
 * Strony Sejmu (przebieg procesu, druk) składa przeglądarka, więc zwykłe pobranie nic nie daje.
 * Dla nich czytamy oficjalne API Sejmu: tytuł, opis projektu i etapy.
 */
async function projektZSejmu(u: URL): Promise<string | null> {
  if (!/(^|\.)sejm\.gov\.pl$/i.test(u.hostname)) return null;
  const nr = u.searchParams.get("nr") ?? u.searchParams.get("druk") ?? u.pathname.match(/(?:druk|nr)[^\d]*(\d{1,5})/i)?.[1];
  if (!nr || !/^\d{1,5}$/.test(nr)) return null;
  const kadencja = u.pathname.match(/Sejm(\d{1,2})/i)?.[1] ?? "10";
  const odp = await fetch(`https://api.sejm.gov.pl/sejm/term${kadencja}/processes/${nr}`, { signal: AbortSignal.timeout(10000) });
  if (!odp.ok) return null;
  type Etap = { date?: string; stageName?: string; children?: Etap[] };
  const d = (await odp.json()) as { title?: string; description?: string; documentDate?: string; passed?: boolean; stages?: Etap[] };
  const etapy: string[] = [];
  const zbierz = (l: Etap[]) => l.forEach((e) => (e.stageName && etapy.push(`${e.date ?? ""} ${e.stageName}`), zbierz(e.children ?? [])));
  zbierz(d.stages ?? []);
  return [
    `Projekt w Sejmie, druk nr ${nr} (kadencja ${kadencja}): ${d.title ?? ""}`,
    `Data projektu: ${d.documentDate ?? ""}${d.passed ? " (uchwalony)" : ""}`,
    `Opis: ${d.description ?? ""}`,
    `Etapy: ${etapy.join("; ")}`,
  ].join("\n");
}

async function trescStrony(u: URL): Promise<string> {
  const zSejmu = await projektZSejmu(u).catch(() => null);
  if (zSejmu) return zSejmu;
  const odp = await fetch(u, {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "WinOver/1.0 (+https://getwinover.com)", Accept: "text/html,text/plain" },
  });
  if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
  const typ = odp.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/xhtml/.test(typ)) throw new Error("typ");
  const html = (await odp.text()).slice(0, 600_000);
  const tytul = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const tekst = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return `${tytul.trim()}\n\n${tekst}`.slice(0, 20_000);
}

export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: wZespole } = await supabase.rpc("czy_w_zespole");
  if (!wZespole) return NextResponse.json({ blad: t("api.brakDostepu") }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const wejscie = String(body.wejscie ?? "").trim().slice(0, 8000);
  if (wejscie.length < 10) return NextResponse.json({ blad: t("agent.zaMalo") }, { status: 400 });

  // Link na początku albo jedyna treść: czytamy stronę. Reszta tekstu to dopisek użytkownika.
  const link = wejscie.match(/https?:\/\/\S+/)?.[0] ?? null;
  let zrodlo = "";
  let linkFilm = "";
  if (link) {
    let u: URL;
    try {
      u = new URL(link);
    } catch {
      return NextResponse.json({ blad: t("agent.zlyLink") }, { status: 400 });
    }
    if (!bezpiecznyAdres(u)) return NextResponse.json({ blad: t("agent.zlyLink") }, { status: 400 });
    if (YT.test(link)) linkFilm = link;
    try {
      zrodlo = await trescStrony(u);
    } catch {
      if (!linkFilm && wejscie.replace(link, "").trim().length < 30)
        return NextResponse.json({ blad: t("agent.nieCzytam") }, { status: 422 });
    }
  }
  const dopisek = link ? wejscie.replace(link, "").trim() : wejscie;

  try {
    const odp = await new Anthropic().beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 2500,
      output_config: { format: betaZodOutputFormat(Brief) },
      messages: [
        {
          role: "user",
          content: [
            "Przygotuj brief kampanii WinOver: organizacja albo mieszkańcy chcą przekonać polskich decydentów (posłów, ministerstwa, samorządy, europosłów) do konkretnego działania.",
            link ? `Link podany przez użytkownika: ${link}` : "",
            dopisek ? `Opis od użytkownika: ${dopisek}` : "",
            zrodlo ? `Treść strony (fragment):\n${zrodlo}` : "",
            "",
            "Zasady: fakty wyłącznie ze źródła i opisu użytkownika, bez dopowiadania liczb. Jeśli źródło jest neutralne (np. artykuł), cel ustaw zgodnie z intencją użytkownika; jeśli jej nie ma, zaproponuj najbardziej oczywistą prośbę do decydentów i napisz w polu brakuje, że trzeba ją potwierdzić.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    const b = odp.parsed_output;
    if (!b) return NextResponse.json({ blad: t("api.nieudanoPropozycji") }, { status: 502 });
    return NextResponse.json({
      nazwa: b.nazwa.slice(0, 80),
      cel: b.cel,
      materialy: `${b.materialy}${link && !linkFilm ? `\n\nŹródło: ${link}` : ""}`,
      linkFilm,
      brakuje: b.brakuje,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ blad: t("api.brakKluczaAI") }, { status: 500 });
    if (e instanceof Anthropic.APIError)
      return NextResponse.json({ blad: t("api.bladAI", { status: String(e.status) }) }, { status: 502 });
    throw e;
  }
}
