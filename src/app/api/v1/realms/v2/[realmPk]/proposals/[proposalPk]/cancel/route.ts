import { NextResponse } from "next/server";
import { cancelProposal } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cancelProposal(params.realmPk, params.proposalPk, {
      walletPk: pubkey,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
