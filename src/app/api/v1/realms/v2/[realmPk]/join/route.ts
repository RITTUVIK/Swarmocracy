import { NextResponse } from "next/server";
import { joinDAO } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await joinDAO(params.realmPk, {
      walletPk: pubkey,
      amount: body.amount,
    });

    await logProtocolEvent(
      "AGENT_JOIN",
      `${pubkey.slice(0, 8)}... joining DAO ${params.realmPk.slice(0, 8)}... via Realms`
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
