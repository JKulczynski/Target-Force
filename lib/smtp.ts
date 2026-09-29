import nodemailer from "nodemailer";

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

/** Tłumaczy błędy SMTP na zdanie, które zrozumie osoba nietechniczna. */
export function opiszBladSmtp(e: unknown): string {
  const tekst = e instanceof Error ? e.message : String(e);
  if (/535|534|Invalid login|Username and Password not accepted|BadCredentials/i.test(tekst))
    return "Serwer odrzucił login albo hasło. Przy Gmailu użyj hasła aplikacji (16 znaków), nie zwykłego hasła do konta.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(tekst)) return "Nie znaleziono serwera poczty. Sprawdź adres serwera (host).";
  if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(tekst))
    return "Serwer poczty nie odpowiada. Sprawdź host i port (zwykle 465 albo 587).";
  return `Serwer poczty zwrócił błąd: ${tekst.slice(0, 200)}`;
}
