import nodemailer from "nodemailer";
import { t, type Jezyk } from "@/lib/i18n";

/** Serwery SMTP najpopularniejszych skrzynek. Reszta: użytkownik podaje host i port sam. */
const ZNANE: Record<string, { host: string; port: number }> = {
  "gmail.com": { host: "smtp.gmail.com", port: 465 },
  "googlemail.com": { host: "smtp.gmail.com", port: 465 },
  "outlook.com": { host: "smtp.office365.com", port: 587 },
  "hotmail.com": { host: "smtp.office365.com", port: 587 },
  "live.com": { host: "smtp.office365.com", port: 587 },
  "wp.pl": { host: "smtp.wp.pl", port: 465 },
  "o2.pl": { host: "poczta.o2.pl", port: 465 },
  "interia.pl": { host: "poczta.interia.pl", port: 465 },
  "onet.pl": { host: "smtp.poczta.onet.pl", port: 465 },
};

export function podpowiedzSerwer(email: string): { host: string; port: number } | null {
  const domena = email.trim().toLowerCase().split("@")[1] ?? "";
  return ZNANE[domena] ?? null;
}

export type DaneSmtp = { host: string; port: number; uzytkownik: string; haslo: string };

export function transport(d: DaneSmtp) {
  return nodemailer.createTransport({
    host: d.host,
    port: d.port,
    secure: d.port === 465,
    auth: { user: d.uzytkownik, pass: d.haslo },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
}

export type RodzajBleduSmtp = "login" | "host" | "timeout" | "inny";

/** Klasa błędu SMTP (niezależna od języka komunikatu): po "login" i "host" nie ma sensu próbować dalej. */
export function rodzajBleduSmtp(e: unknown): RodzajBleduSmtp {
  const tekst = e instanceof Error ? e.message : String(e);
  if (/535|534|Invalid login|Username and Password not accepted|BadCredentials/i.test(tekst)) return "login";
  if (/ENOTFOUND|EAI_AGAIN/i.test(tekst)) return "host";
  if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(tekst)) return "timeout";
  return "inny";
}

/** Tłumaczy błędy SMTP na zdanie, które zrozumie osoba nietechniczna (w języku użytkownika, domyślnie pl). */
export function opiszBladSmtp(e: unknown, jezyk: Jezyk = "pl"): string {
  const tekst = e instanceof Error ? e.message : String(e);
  return t(jezyk, `smtp.${rodzajBleduSmtp(e)}`, { tekst: tekst.slice(0, 200) });
}
