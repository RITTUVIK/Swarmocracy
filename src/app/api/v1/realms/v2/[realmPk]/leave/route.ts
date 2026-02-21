import { NextResponse } from "next/server";
import { leaveDAO } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await leaveDAO(params.realmPk, { walletPk: pubkey });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
