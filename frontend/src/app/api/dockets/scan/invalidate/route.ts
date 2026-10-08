import { NextResponse } from "next/server";
import { invalidateScan } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

/** Drop the memoised docket scan so a just-written docket is visible immediately. */
export async function POST(req: Request) {
  let nonce = 0;
  try {
    const body = await req.json();
    nonce = Number(body?.nonce ?? 0);
  } catch {
    /* nonce is advisory */
  }
  invalidateScan(nonce);
  return NextResponse.json({ ok: true, nonce });
}
