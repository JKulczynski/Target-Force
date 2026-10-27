import type { NextConfig } from "next";

/**
 * Nagłówki bezpieczeństwa (27.10, test manualny S1). Aplikacji nie wolno osadzać w ramce na obcej
 * stronie (clickjacking). Wyjątek: publiczna strona akcji /a/{slug}, bo klient wkleja ją u siebie
 * przez widżet <iframe> (components/StronaAkcji.tsx).
 */
const WSPOLNE = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/a/:slug*", headers: WSPOLNE },
      {
        source: "/((?!a/).*)",
        headers: [
          ...WSPOLNE,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
