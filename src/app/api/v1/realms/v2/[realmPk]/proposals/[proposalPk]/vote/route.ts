import { NextResponse } from "next/server";
import { castVote } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vote } = await request.json();

    if (!["yes", "no", "abstain", "veto"].includes(vote)) {
      return NextResponse.json(
        { error: "vote must be 'yes', 'no', 'abstain', or 'veto'" },
        { status: 400 }
      );
    }

    const result = await castVote(params.realmPk, params.proposalPk, {
      walletPk: pubkey,
      vote,
    });

    await logProtocolEvent(
      "AGENT_VOTE",
      `${pubkey.slice(0, 8)}... voted ${vote.toUpperCase()} via Realms v2`
    );

    return NextResponse.json({
      ...result,
      message:
        "Sign and send the returned transaction(s) to cast your vote on-chain.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
