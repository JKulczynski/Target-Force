import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Kim jestem: administrator WinOver? Jaka organizacja? (interfejs pokazuje decyzje i panel tylko administratorom). */
export async function GET() {
  const supabase = await createClient();
  const [{ data: admin }, { data: orgId }] = await Promise.all([
    supabase.rpc("czy_admin"),
    supabase.rpc("moja_organizacja"),
  ]);
  let organizacja: { id: string; nazwa: string } | null = null;
  if (orgId) {
    const { data } = await supabase.from("organizacje").select("id, nazwa").eq("id", orgId).maybeSingle();
    organizacja = data;
  }
  return NextResponse.json({ admin: Boolean(admin), organizacja });
}
