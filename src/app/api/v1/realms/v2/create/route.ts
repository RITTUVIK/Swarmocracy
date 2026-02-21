import { NextResponse } from "next/server";
import { createDAO } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(request: Request) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, communityMintPk, minCommunityTokensToCreateProposal, communityVoteThresholdPercentage } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const result = await createDAO({
      name,
      walletPk: pubkey,
      communityMintPk,
      minCommunityTokensToCreateProposal,
      communityVoteThresholdPercentage,
    });

    await logProtocolEvent(
      "INFO",
      `DAO "${name}" creation initiated by ${pubkey.slice(0, 8)}... via Realms v2`
    );

    return NextResponse.json({
      ...result,
      message:
        "Sign and send all returned transactions to create the DAO on-chain.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
