import { NextResponse } from "next/server";
import { DocketNotFound, getDocket } from "@/lib/genlayer";
import { serialise } from "@/lib/serialise";

export const dynamic = "force-dynamic";

/** Read one docket from chain, server-side. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docketId = Number(id);
  if (!Number.isInteger(docketId) || docketId < 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  try {
    return NextResponse.json({ docket: serialise(await getDocket(docketId)) });
  } catch (err) {
    if (err instanceof DocketNotFound) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: (err as Error)?.message ?? "rpc error" },
      { status: 502 },
    );
  }
}
