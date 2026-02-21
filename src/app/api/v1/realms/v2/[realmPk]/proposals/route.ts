import { NextResponse } from "next/server";
import { listProposals, createProposal } from "@/lib/realmsClient";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { logProtocolEvent } from "@/lib/execution";

export async function GET(
  request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") ?? undefined;
    const proposals = await listProposals(params.realmPk, state as any);
    return NextResponse.json(proposals);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string } }
) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, governancePk, instructions } = body;

    if (!name || !description || !governancePk) {
      return NextResponse.json(
        { error: "name, description, and governancePk are required" },
        { status: 400 }
      );
    }

    const result = await createProposal(params.realmPk, {
      name,
      description,
      governancePk,
      walletPk: pubkey,
      instructions,
    });

    await logProtocolEvent(
      "PROPOSAL_NEW",
      `Proposal "${name}" created on Realms by ${pubkey.slice(0, 8)}...`
    );

    return NextResponse.json({
      ...result,
      message:
        "Sign and send all returned transactions in order. " +
        "Use POST /api/v1/tx/orchestrate to sign and send.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
