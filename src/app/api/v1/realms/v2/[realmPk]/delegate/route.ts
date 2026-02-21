import { NextResponse } from "next/server";
import { delegateVote, undelegateVote } from "@/lib/realmsClient";
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

    const { delegatePk, tokenType, action } = await request.json();

    if (!delegatePk) {
      return NextResponse.json(
        { error: "delegatePk is required" },
        { status: 400 }
      );
    }

    const fn = action === "undelegate" ? undelegateVote : delegateVote;
    const result = await fn(params.realmPk, {
      walletPk: pubkey,
      delegatePk,
      tokenType,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
