import { NextResponse } from "next/server";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { validateAndWarn, SowellianBetParams } from "@/lib/sowellianBet";
import { createSowellianBet } from "@/lib/realmsClient";
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

    const body = await request.json();
    const {
      governancePk,
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      expiry,
      description,
    } = body;

    if (!governancePk || !inputMint || !outputMint || !inAmount || !outAmount) {
      return NextResponse.json(
        {
          error:
            "governancePk, inputMint, outputMint, inAmount, outAmount are required",
        },
        { status: 400 }
      );
    }

    const betParams: SowellianBetParams = {
      realmPk: params.realmPk,
      governancePk,
      walletPk: pubkey,
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      expiry,
      description,
    };

    const warnings = validateAndWarn(betParams);

    const result = await createSowellianBet(params.realmPk, {
      walletPk: pubkey,
      governancePk,
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      expiry,
      description,
    });

    await logProtocolEvent(
      "WARN",
      `Sowellian bet created by ${pubkey.slice(0, 8)}...: ${result.transactions?.length ?? 0} txs. COLLATERAL LOCK RISK.`
    );

    return NextResponse.json({
      ...result,
      warnings,
      txCount: result.transactions?.length ?? 0,
      message:
        "CRITICAL: You MUST sign and send ALL transactions in order. " +
        "The last transaction contains sign-off + register_vote. " +
        "If you skip it, your bet collateral is PERMANENTLY LOCKED. " +
        "Use POST /api/v1/tx/orchestrate to sign and send all transactions safely.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode ?? 500 }
    );
  }
}
