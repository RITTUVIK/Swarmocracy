import { NextResponse } from "next/server";
import { signAndSendAll, persistOrchestratorResult } from "@/lib/txOrchestrator";
import { resolveKeypair, WalletRole } from "@/lib/walletManager";
import { logProtocolEvent } from "@/lib/execution";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      transactions,
      walletRole,
      realmPk,
      agentSecretKey,
      proposalId,
      type,
      abortOnFailure,
    } = body;

    if (!transactions?.length) {
      return NextResponse.json(
        { error: "transactions array is required" },
        { status: 400 }
      );
    }

    if (!walletRole || !realmPk) {
      return NextResponse.json(
        { error: "walletRole and realmPk are required" },
        { status: 400 }
      );
    }

    const keypair = await resolveKeypair(
      walletRole as WalletRole,
      realmPk,
      agentSecretKey
    );

    const result = await signAndSendAll(transactions, [keypair], {
      abortOnFailure: abortOnFailure ?? true,
      logPrefix: type ?? "TX_ORCHESTRATE",
    });

    if (proposalId) {
      await persistOrchestratorResult(
        proposalId,
        type ?? "orchestrate",
        JSON.stringify({ realmPk, txCount: transactions.length }),
        result
      );
    }

    if (!result.success) {
      await logProtocolEvent(
        "ERROR",
        `Orchestration failed: ${result.error}`
      );
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Orchestration failed" },
      { status: 500 }
    );
  }
}
