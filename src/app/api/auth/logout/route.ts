import { NextResponse } from "next/server";
import { borrarCookie } from "@/lib/auth/sesion";

export async function POST() {
  await borrarCookie();
  return NextResponse.json({ ok: true });
}
