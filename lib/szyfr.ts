import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Szyfrowanie haseł skrzynek (AES-256-GCM). Klucz tylko w zmiennej środowiskowej serwera,
 * więc zaszyfrowane hasło w bazie jest bezużyteczne bez dostępu do Vercela.
 */

function klucz(): Buffer {
  const k = process.env.TF_KLUCZ_SZYFROWANIA;
  if (!k) throw new Error("Brak TF_KLUCZ_SZYFROWANIA");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("TF_KLUCZ_SZYFROWANIA musi mieć 32 bajty (base64)");
  return b;
}

/** Zwraca "iv.tag.dane" w base64. */
export function zaszyfruj(tekst: string): string {
  const iv = randomBytes(12);
  const szyfr = createCipheriv("aes-256-gcm", klucz(), iv);
  const dane = Buffer.concat([szyfr.update(tekst, "utf8"), szyfr.final()]);
  return [iv, szyfr.getAuthTag(), dane].map((b) => b.toString("base64")).join(".");
}

export function odszyfruj(zapis: string): string {
  const [iv, tag, dane] = zapis.split(".").map((c) => Buffer.from(c, "base64"));
  const deszyfr = createDecipheriv("aes-256-gcm", klucz(), iv);
  deszyfr.setAuthTag(tag);
  return Buffer.concat([deszyfr.update(dane), deszyfr.final()]).toString("utf8");
}
