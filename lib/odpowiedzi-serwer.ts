import { ImapFlow } from "imapflow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { t, type Jezyk } from "@/lib/i18n";

/**
 * Automatyczne "odpisał": zaglądamy do skrzynki nadawcy przez IMAP i szukamy maili, które są odpowiedzią
 * na nasze wysyłki (nagłówek In-Reply-To / References = Message-ID zapisany w `wiadomosci`), a w drugiej
 * kolejności maili od adresów z listy odbiorców, do których coś poszło. Do tej pory zespół klikał "odpisał" ręcznie.
 * Klient Supabase przychodzi z zewnątrz: sesja użytkownika (przycisk) albo klient serwisowy (cron).
 */

/** Serwery IMAP popularnych skrzynek; dla innych zgadujemy z hosta SMTP ("smtp." -> "imap."). */
const ZNANE_IMAP: Record<string, string> = {
  "smtp.gmail.com": "imap.gmail.com",
  "smtp.office365.com": "outlook.office365.com",
  "smtp.wp.pl": "imap.wp.pl",
  "poczta.o2.pl": "poczta.o2.pl",
  "poczta.interia.pl": "poczta.interia.pl",
  "smtp.poczta.onet.pl": "imap.poczta.onet.pl",
};

export function hostImap(smtpHost: string, imapHost?: string | null): string {
  if (imapHost) return imapHost;
  return ZNANE_IMAP[smtpHost] ?? smtpHost.replace(/^smtp\./, "imap.");
}

type Skrzynka = {
  id: string;
  email_nadawcy: string;
  smtp_host: string;
  smtp_uzytkownik: string;
  imap_host: string | null;
  imap_port: number;
  odpowiedzi_sprawdzone: string | null;
};

export type WynikOdpowiedzi = {
  sprawdzono: number;
  nowe: { kontaktId: string; email: string; kampaniaId: string; temat: string; data: string }[];
};

/** Czyści Message-ID z nawiasów i spacji, żeby porównywać jak z jak. */
const czysty = (s: string | null | undefined) => (s ?? "").trim().replace(/^<|>$/g, "");

export async function sprawdzOdpowiedzi(
  supabase: SupabaseClient,
  s: Skrzynka,
  haslo: string,
  o: { kampaniaId?: string; odKiedy?: Date } = {},
): Promise<WynikOdpowiedzi> {
  // Wysłane wiadomości tej skrzynki (wszystkie kampanie albo jedna), do dopasowania po Message-ID i po adresie.
  let zapytanie = supabase
    .from("wiadomosci")
    .select("id, kampania_id, kontakt_id, message_id, temat, wyslana, kontakty!inner(email, imie, nazwisko, odpowiedzial)")
    .eq("status", "wyslana");
  if (o.kampaniaId) zapytanie = zapytanie.eq("kampania_id", o.kampaniaId);
  else {
    const { data: kampanie } = await supabase.from("kampanie").select("id").eq("skrzynka_id", s.id);
    const ids = (kampanie ?? []).map((k) => k.id);
    if (ids.length === 0) return { sprawdzono: 0, nowe: [] };
    zapytanie = zapytanie.in("kampania_id", ids);
  }
  const { data: wyslane } = await zapytanie;
  if (!wyslane?.length) return { sprawdzono: 0, nowe: [] };

  type W = (typeof wyslane)[number] & {
    kontakty: { email: string | null; imie: string | null; nazwisko: string | null; odpowiedzial: string | null };
  };
  const poMessageId = new Map<string, W>();
  const poAdresie = new Map<string, W>();
  let najstarsza = Date.now();
  for (const w of wyslane as W[]) {
    if (w.message_id) poMessageId.set(czysty(w.message_id), w);
    const adres = w.kontakty.email?.toLowerCase();
    if (adres && !poAdresie.has(adres)) poAdresie.set(adres, w);
    if (w.wyslana) najstarsza = Math.min(najstarsza, new Date(w.wyslana).getTime());
  }
  const od = o.odKiedy ?? (s.odpowiedzi_sprawdzone ? new Date(s.odpowiedzi_sprawdzone) : new Date(najstarsza));
  od.setDate(od.getDate() - 1); // zapas na strefy czasowe i opóźnienia

  const klient = new ImapFlow({
    host: hostImap(s.smtp_host, s.imap_host),
    port: s.imap_port || 993,
    secure: true,
    auth: { user: s.smtp_uzytkownik || s.email_nadawcy, pass: haslo },
    logger: false,
    connectionTimeout: 20_000,
  });

  const nowe: WynikOdpowiedzi["nowe"] = [];
  let sprawdzono = 0;
  await klient.connect();
  try {
    const skrzynka = await klient.getMailboxLock("INBOX");
    try {
      const uids = await klient.search({ since: od }, { uid: true });
      const lista = Array.isArray(uids) ? uids : [];
      for await (const msg of klient.fetch(lista, { uid: true, envelope: true, headers: ["in-reply-to", "references"] }, { uid: true })) {
        sprawdzono++;
        const naglowki = msg.headers?.toString() ?? "";
        const odwolania = [...naglowki.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
        const nadawca = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        const trafiona = odwolania.map((r) => poMessageId.get(r)).find(Boolean) ?? (nadawca ? poAdresie.get(nadawca) : undefined);
        if (!trafiona || trafiona.kontakty.odpowiedzial) continue;
        const data = msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString();
        // Odpowiedź musi być późniejsza niż nasza wysyłka do tej osoby.
        if (trafiona.wyslana && data < trafiona.wyslana) continue;
        await supabase.from("kontakty").update({ odpowiedzial: data }).eq("id", trafiona.kontakt_id);
        await supabase.from("zdarzenia").insert({ wiadomosc_id: trafiona.id, typ: "odpowiedz", meta: { temat: msg.envelope?.subject ?? "" } });
        const kto = [trafiona.kontakty.imie, trafiona.kontakty.nazwisko].filter(Boolean).join(" ") || nadawca;
        await supabase.from("wydarzenia_wplywu").insert({
          kampania_id: trafiona.kampania_id,
          data: data.slice(0, 10),
          typ: "odpowiedz",
          opis: `Odpowiedź od ${kto}: ${msg.envelope?.subject ?? "(bez tematu)"}`,
          kontakt_id: trafiona.kontakt_id,
        });
        trafiona.kontakty.odpowiedzial = data;
        nowe.push({ kontaktId: trafiona.kontakt_id, email: nadawca, kampaniaId: trafiona.kampania_id, temat: msg.envelope?.subject ?? "", data });
      }
    } finally {
      skrzynka.release();
    }
  } finally {
    await klient.logout().catch(() => {});
  }
  await supabase.from("skrzynki").update({ odpowiedzi_sprawdzone: new Date().toISOString() }).eq("id", s.id);
  return { sprawdzono, nowe };
}

/** Tłumaczy błędy IMAP na zdanie dla człowieka (w języku użytkownika, domyślnie pl). */
export function opiszBladImap(e: unknown, jezyk: Jezyk = "pl"): string {
  const tekst = e instanceof Error ? e.message : String(e);
  const rodzaj = /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed/i.test(tekst)
    ? "login"
    : /ENOTFOUND|EAI_AGAIN/i.test(tekst)
      ? "host"
      : /ETIMEDOUT|ECONNREFUSED|timeout/i.test(tekst)
        ? "timeout"
        : "inny";
  return t(jezyk, `imap.${rodzaj}`, { tekst: tekst.slice(0, 200) });
}
