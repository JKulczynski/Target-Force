/**
 * Adres aplikacji do linków w mailach (śledzące /r/, wypisanie /w/, potwierdzenia /p/, zaproszenia).
 * Na produkcji zawsze własna domena, niezależnie od tego, czy żądanie przyszło na target-force.vercel.app
 * (np. automat) czy na adres wdrożenia. Lokalnie i w podglądach: adres, z którego przyszło żądanie.
 */
export const DOMENA_PRODUKCYJNA = process.env.WINOVER_ADRES ?? "https://getwinover.com";

export const adresAplikacji = (origin: string) =>
  process.env.VERCEL_ENV === "production" ? DOMENA_PRODUKCYJNA : origin;
