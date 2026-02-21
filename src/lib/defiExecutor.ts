/**
 * Generic DeFi execution layer.
 * Supports arbitrary instruction bundles from Realms proposals:
 *   - Omnipair (borrow/collateral)
 *   - Jupiter (swaps, limit orders, DCA)
 *   - Drift (perps, deposits)
 *   - Kamino (lending)
 *   - Save/Solend (staking)
 *   - Native SOL staking
 *   - Any arbitrary Solana program
 *
 * Execution is generic: sign and send whatever instructions the proposal contains.
 * Omnipair-specific logic is preserved as a specialized handler.
 */

import { Keypair } from "@solana/web3.js";
import { prisma } from "./prisma";
import { logProtocolEvent } from "./execution";
import { signAndSendAll, persistOrchestratorResult, OrchestratorResult } from "./txOrchestrator";
import { resolveKeypair, WalletRole } from "./walletManager";
import * as RealmsClient from "./realmsClient";
import { executeBorrow, BorrowParams } from "./omnipair";

export type ExecutionType =
  | "omnipair_borrow"
  | "realms_execute"
  | "sowellian_bet"
  | "defi_instructions"
  | "governance";

export interface ExecutionRequest {
  proposalId: string;
  realmPk: string;
  type: ExecutionType;
  walletRole: WalletRole;
  agentSecretKey?: string;
  params: Record<string, unknown>;
}

export interface ExecutionResult {
  status: "success" | "failed" | "partial";
  signatures: string[];
  error?: string;
}

/**
 * Execute a proposal based on its type.
 */
export async function executeProposalGeneric(
  req: ExecutionRequest
): Promise<ExecutionResult> {
  const { proposalId, realmPk, type, walletRole, agentSecretKey, params } = req;

  await prisma.proposalCache.update({
    where: { id: proposalId },
    data: { executionStatus: "executing" },
  });

  await logProtocolEvent(
    "EXECUTE_START",
    `Executing [${type}] for proposal ${proposalId.slice(0, 8)}...`
  );

  try {
    const keypair = await resolveKeypair(walletRole, realmPk, agentSecretKey);
    let result: ExecutionResult;

    switch (type) {
      case "omnipair_borrow":
        result = await executeOmnipairBorrow(proposalId, keypair, params);
        break;

      case "realms_execute":
        result = await executeRealmsProposal(proposalId, realmPk, keypair);
        break;

      case "defi_instructions":
        result = await executeDefiInstructions(proposalId, keypair, params);
        break;

      default:
        throw new Error(`Unsupported execution type: ${type}`);
    }

    const finalStatus = result.status === "success" ? "success" : "failed";

    await prisma.proposalCache.update({
      where: { id: proposalId },
      data: {
        executionStatus: finalStatus,
        executionTxSignature: result.signatures[0] ?? null,
        state: finalStatus === "success" ? "Completed" : undefined,
      },
    });

    await logProtocolEvent(
      finalStatus === "success" ? "EXECUTE_DONE" : "ERROR",
      `[${type}] ${finalStatus}: ${result.signatures[0]?.slice(0, 16) ?? result.error ?? "unknown"}`
    );

    return result;
  } catch (err: any) {
    const errorMsg = err.message || "Unknown execution error";

    await prisma.proposalCache.update({
      where: { id: proposalId },
      data: { executionStatus: "failed" },
    });

    await logProtocolEvent("ERROR", `[${type}] execution failed: ${errorMsg}`);

    return { status: "failed", signatures: [], error: errorMsg };
  }
}

// ─── Omnipair Borrow ──────────────────────────────────────────────────

async function executeOmnipairBorrow(
  proposalId: string,
  keypair: Keypair,
  params: Record<string, unknown>
): Promise<ExecutionResult> {
  const borrowParams: BorrowParams = {
    pairAddress: params.pairAddress as string,
    collateralMint: params.collateralMint as string,
    collateralAmount: params.collateralAmount as string,
    borrowMint: params.borrowMint as string,
    borrowAmount: params.borrowAmount as string,
  };

  if (
    !borrowParams.pairAddress ||
    !borrowParams.collateralMint ||
    !borrowParams.collateralAmount ||
    !borrowParams.borrowMint ||
    !borrowParams.borrowAmount
  ) {
    throw new Error("Missing required Omnipair borrow parameters");
  }

  const result = await executeBorrow(keypair, borrowParams);

  await prisma.executionLog.create({
    data: {
      proposalId,
      type: "omnipair_borrow",
      status: "success",
      txSignature: result.txSignature,
      inputParams: JSON.stringify(borrowParams),
      outputData: JSON.stringify(result),
      executedAt: new Date(),
    },
  });

  return { status: "success", signatures: [result.txSignature] };
}

// ─── Realms Proposal Execution ────────────────────────────────────────

async function executeRealmsProposal(
  proposalId: string,
  realmPk: string,
  keypair: Keypair
): Promise<ExecutionResult> {
  const response = await RealmsClient.executeProposalOnRealms(realmPk, proposalId);

  if (!response.transactions?.length) {
    throw new Error("No transactions returned from Realms execute endpoint");
  }

  const orchResult = await signAndSendAll(response.transactions, [keypair], {
    abortOnFailure: true,
    logPrefix: "REALMS_EXECUTE",
  });

  await persistOrchestratorResult(
    proposalId,
    "realms_execute",
    JSON.stringify({ realmPk, proposalId }),
    orchResult
  );

  if (!orchResult.success) {
    return {
      status: "failed",
      signatures: orchResult.results
        .filter((r) => r.signature)
        .map((r) => r.signature),
      error: orchResult.error,
    };
  }

  return {
    status: "success",
    signatures: orchResult.results.map((r) => r.signature),
  };
}

// ─── Generic DeFi Instructions ────────────────────────────────────────

async function executeDefiInstructions(
  proposalId: string,
  keypair: Keypair,
  params: Record<string, unknown>
): Promise<ExecutionResult> {
  const txs = params.transactions as string[];

  if (!txs?.length) {
    throw new Error("No transactions provided for DeFi execution");
  }

  const orchResult = await signAndSendAll(txs, [keypair], {
    abortOnFailure: true,
    logPrefix: "DEFI_EXEC",
  });

  await persistOrchestratorResult(
    proposalId,
    "defi_instructions",
    JSON.stringify({ txCount: txs.length }),
    orchResult
  );

  if (!orchResult.success) {
    return {
      status: "failed",
      signatures: orchResult.results
        .filter((r) => r.signature)
        .map((r) => r.signature),
      error: orchResult.error,
    };
  }

  return {
    status: "success",
    signatures: orchResult.results.map((r) => r.signature),
  };
}
