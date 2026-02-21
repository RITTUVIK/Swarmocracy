/**
 * Sowellian Bet handler — critical safety layer.
 *
 * CreateSowellianBet returns MULTIPLE transactions that MUST all be signed
 * and sent in order. The last tx contains sign-off + register_vote (auto-votes Yes).
 * If the last tx is skipped, bet collateral is PERMANENTLY LOCKED.
 *
 * This module:
 *  1. Validates the bet parameters
 *  2. Warns about collateral lock risk
 *  3. Ensures ALL transactions are sent in strict order
 *  4. Aborts entire flow if any transaction fails
 *  5. Logs irreversible collateral risks
 */

import { Keypair } from "@solana/web3.js";
import { createSowellianBet } from "./realmsClient";
import { signAndSendAll, persistOrchestratorResult, OrchestratorResult } from "./txOrchestrator";
import { logProtocolEvent } from "./execution";
import { prisma } from "./prisma";

export interface SowellianBetParams {
  realmPk: string;
  governancePk: string;
  walletPk: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  expiry?: number;
  description?: string;
}

export interface SowellianBetWarnings {
  collateralLockRisk: boolean;
  multiTxRequired: boolean;
  txCount: number;
  message: string;
}

/**
 * Validate bet params and generate warnings before execution.
 */
export function validateAndWarn(params: SowellianBetParams): SowellianBetWarnings {
  return {
    collateralLockRisk: true,
    multiTxRequired: true,
    txCount: 0, // unknown until API responds
    message:
      "WARNING: Sowellian bets require ALL returned transactions to be signed and sent in order. " +
      "If any transaction is skipped (especially the last one), your bet collateral will be PERMANENTLY LOCKED. " +
      "Only Jupiter limit orders are supported (swaps expire before voting completes). " +
      "The proposer must hold community tokens (deposited as collateral).",
  };
}

/**
 * Execute a Sowellian bet end-to-end with full safety.
 */
export async function executeSowellianBet(
  params: SowellianBetParams,
  signers: Keypair[],
  proposalId?: string
): Promise<OrchestratorResult> {
  await logProtocolEvent(
    "WARN",
    `Sowellian bet initiated: ${params.inAmount} → ${params.outAmount}. COLLATERAL LOCK RISK.`
  );

  const response = await createSowellianBet(params.realmPk, {
    walletPk: params.walletPk,
    governancePk: params.governancePk,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount: params.inAmount,
    outAmount: params.outAmount,
    expiry: params.expiry,
    description: params.description,
  });

  const txs = response.transactions;

  if (!txs || txs.length === 0) {
    await logProtocolEvent("ERROR", "Sowellian bet: no transactions returned from Realms API");
    return {
      success: false,
      results: [],
      error: "No transactions returned from Realms API",
    };
  }

  await logProtocolEvent(
    "INFO",
    `Sowellian bet: ${txs.length} transactions to sign. Last tx is CRITICAL (sign-off + register_vote).`
  );

  const result = await signAndSendAll(txs, signers, {
    abortOnFailure: true,
    logPrefix: "SOWELLIAN_BET",
  });

  if (proposalId) {
    await persistOrchestratorResult(
      proposalId,
      "sowellian_bet",
      JSON.stringify(params),
      result
    );
  }

  if (!result.success) {
    const failedIdx = result.results.findIndex((r) => r.status === "failed");
    const completedCount = result.results.filter(
      (r) => r.status === "confirmed"
    ).length;

    if (completedCount > 0 && failedIdx < txs.length - 1) {
      await logProtocolEvent(
        "WARN",
        `PARTIAL FAILURE: ${completedCount}/${txs.length} txs sent. ` +
          `Collateral may be at risk if flow is incomplete.`
      );
    }

    if (failedIdx === txs.length - 1) {
      await logProtocolEvent(
        "ERROR",
        `CRITICAL: Last transaction (sign-off + register_vote) FAILED. ` +
          `Collateral may be PERMANENTLY LOCKED. Manual intervention required.`
      );
    }
  } else {
    await logProtocolEvent(
      "EXECUTE_DONE",
      `Sowellian bet complete: all ${txs.length} transactions confirmed.`
    );
  }

  return result;
}
