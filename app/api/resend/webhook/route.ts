import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Webhook Resend (14.10): email.bounced (twarde odbicie) i email.complained (oznaczone jako spam).
 * Adres trafia do blokady_adresow, a wiadomość mieszkańca dostaje opis błędu. Podpis w standardzie Svix:
 * HMAC-SHA256 z "id.timestamp.body", klucz = base64 z RESEND_WEBHOOK_SECRET bez "whsec_".
 */
function podpisOk(req: NextRequest, body: string): boolean {
  const sekret = process.env.RESEND_WEBHOOK_SECRET;
  const id = req.headers.get("svix-id");
  const czas = req.headers.get("svix-timestamp");
  const podpisy = req.headers.get("svix-signature");
  if (!sekret || !id || !czas || !podpisy) return false;
  if (Math.abs(Date.now() / 1000 - Number(czas)) > 5 * 60) return false;
  const klucz = Buffer.from(sekret.replace(/^whsec_/, ""), "base64");
  const oczekiwany = crypto.createHmac("sha256", klucz).update(`${id}.${czas}.${body}`).digest();
  return podpisy.split(" ").some((p) => {
    const [, sig] = p.split(",");
    const b = Buffer.from(sig ?? "", "base64");
    return b.length === oczekiwany.length && crypto.timingSafeEqual(b, oczekiwany);
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!podpisOk(req, body)) return NextResponse.json({ blad: "zly podpis" }, { status: 401 });
  const z = JSON.parse(body) as { type?: string; data?: { email_id?: string; to?: string[] } };
  const powod = z.type === "email.bounced" ? "odbicie" : z.type === "email.complained" ? "skarga" : null;
  if (!powod) return NextResponse.json({ ok: true, pominiete: z.type });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ blad: "brak bazy" }, { status: 500 });
  const adresy = (z.data?.to ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (adresy.length)
    await admin
      .from("blokady_adresow")
      .upsert(adresy.map((email) => ({ email, powod, message_id: z.data?.email_id ?? null })), { onConflict: "email" });
  if (z.data?.email_id && powod === "odbicie")
    await admin
      .from("podpisy_wysylka")
      .update({ blad: "Adresat nie istnieje albo odrzucil wiadomosc (odbicie)" })
      .eq("message_id", z.data.email_id);
  console.log(`[resend webhook] ${z.type} ${adresy.join(", ")}`);
  return NextResponse.json({ ok: true });
}
