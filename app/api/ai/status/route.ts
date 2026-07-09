import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";

export const runtime = "nodejs";

/** O cliente usa isto para decidir se mostra os recursos de IA. */
export async function GET() {
  return NextResponse.json({ enabled: aiConfigured() });
}
