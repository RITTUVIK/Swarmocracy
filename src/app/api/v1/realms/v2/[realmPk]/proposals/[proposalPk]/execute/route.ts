import { NextResponse } from "next/server";
import { executeProposalOnRealms } from "@/lib/realmsClient";
import { signAndSendAll, persistOrchestratorResult } from "@/lib/txOrchestrator";
import { resolveKeypair } from "@/lib/walletManager";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(
  request: Request,
  { params }: { params: { realmPk: string; proposalPk: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const walletRole = body.walletRole ?? "treasury";
    const agentSecretKey = body.agentSecretKey;

    const keypair = await resolveKeypair(
      walletRole,
      params.realmPk,
      agentSecretKey
    );

    const response = await executeProposalOnRealms(
      params.realmPk,
      params.proposalPk
    );

    if (!response.transactions?.length) {
      return NextResponse.json(
        { error: "No transactions returned from Realms execute endpoint" },
        { status: 400 }
      );
    }

    const result = await signAndSendAll(response.transactions, [keypair], {
      abortOnFailure: true,
      logPrefix: "REALMS_EXECUTE",
    });

    await persistOrchestratorResult(
      params.proposalPk,
      "realms_execute",
      JSON.stringify({ realmPk: params.realmPk }),
      result
    );

    if (!result.success) {
      await logProtocolEvent(
        "ERROR",
        `Realms execute failed for ${params.proposalPk.slice(0, 8)}...`
      );
      return NextResponse.json(
        { success: false, results: result.results, error: result.error },
        { status: 500 }
      );
    }

    await logProtocolEvent(
      "EXECUTE_DONE",
      `Realms proposal ${params.proposalPk.slice(0, 8)}... executed successfully`
    );

    return NextResponse.json({
      success: true,
      signatures: result.results.map((r) => r.signature),
      results: result.results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Execution failed" },
      { status: 500 }
    );
  }
}
