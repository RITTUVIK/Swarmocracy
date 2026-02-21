import {
  Transaction,
  VersionedTransaction,
  Keypair,
  Connection,
  SendOptions,
} from "@solana/web3.js";
import { getConnection } from "./solana";
import { prisma } from "./prisma";
import { logProtocolEvent } from "./execution";

export type TxStatus = "pending" | "sent" | "confirmed" | "failed";

export interface TxResult {
  index: number;
  signature: string;
  status: TxStatus;
  error?: string;
}

export interface OrchestratorResult {
  success: boolean;
  results: TxResult[];
  error?: string;
}

function deserializeTx(
  encoded: string
): Transaction | VersionedTransaction {
  const buf = Buffer.from(encoded, "base64");
  try {
    return VersionedTransaction.deserialize(buf);
  } catch {
    return Transaction.from(buf);
  }
}

function signTx(
  tx: Transaction | VersionedTransaction,
  signers: Keypair[]
): void {
  if (tx instanceof VersionedTransaction) {
    tx.sign(signers);
  } else {
    tx.partialSign(...signers);
  }
}

function serializeTx(tx: Transaction | VersionedTransaction): Buffer {
  if (tx instanceof VersionedTransaction) {
    return Buffer.from(tx.serialize());
  }
  return tx.serialize();
}

async function sendAndConfirmWithRetry(
  connection: Connection,
  rawTx: Buffer,
  opts: {
    maxRetries?: number;
    retryDelayMs?: number;
    confirmCommitment?: "processed" | "confirmed" | "finalized";
  } = {}
): Promise<string> {
  const maxRetries = opts.maxRetries ?? 3;
  const retryDelay = opts.retryDelayMs ?? 2000;
  const commitment = opts.confirmCommitment ?? "confirmed";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const sendOpts: SendOptions = {
        skipPreflight: false,
        maxRetries: 2,
      };

      const signature = await connection.sendRawTransaction(rawTx, sendOpts);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash(commitment);

      const confirmResult = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        commitment
      );

      if (confirmResult.value.err) {
        throw new Error(
          `Transaction confirmed with error: ${JSON.stringify(confirmResult.value.err)}`
        );
      }

      return signature;
    } catch (err: any) {
      lastError = err;

      const msg = err.message ?? "";
      const nonRetryable =
        msg.includes("Blockhash not found") ||
        msg.includes("insufficient funds") ||
        msg.includes("already been processed") ||
        msg.includes("Transaction simulation failed");

      if (nonRetryable) throw err;

      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("sendAndConfirmWithRetry: exhausted retries");
}

/**
 * Sign and send a single serialized transaction.
 */
export async function signAndSend(
  serializedTx: string,
  signers: Keypair[],
  connection?: Connection
): Promise<TxResult> {
  const conn = connection ?? getConnection();
  const tx = deserializeTx(serializedTx);
  signTx(tx, signers);
  const raw = serializeTx(tx);

  try {
    const signature = await sendAndConfirmWithRetry(conn, raw);
    return { index: 0, signature, status: "confirmed" };
  } catch (err: any) {
    return {
      index: 0,
      signature: "",
      status: "failed",
      error: err.message,
    };
  }
}

/**
 * Sign and send multiple transactions IN ORDER.
 * Aborts on first failure. Critical for Sowellian bets.
 */
export async function signAndSendAll(
  serializedTxs: string[],
  signers: Keypair[],
  opts?: {
    connection?: Connection;
    abortOnFailure?: boolean;
    logPrefix?: string;
  }
): Promise<OrchestratorResult> {
  const conn = opts?.connection ?? getConnection();
  const abortOnFail = opts?.abortOnFailure ?? true;
  const prefix = opts?.logPrefix ?? "TX_ORCHESTRATE";
  const results: TxResult[] = [];

  for (let i = 0; i < serializedTxs.length; i++) {
    const tx = deserializeTx(serializedTxs[i]);
    signTx(tx, signers);
    const raw = serializeTx(tx);

    try {
      const signature = await sendAndConfirmWithRetry(conn, raw);
      const result: TxResult = { index: i, signature, status: "confirmed" };
      results.push(result);

      await logProtocolEvent(
        "TX_CONFIRM",
        `${prefix} [${i + 1}/${serializedTxs.length}] confirmed: ${signature.slice(0, 16)}...`
      );
    } catch (err: any) {
      const result: TxResult = {
        index: i,
        signature: "",
        status: "failed",
        error: err.message,
      };
      results.push(result);

      await logProtocolEvent(
        "ERROR",
        `${prefix} [${i + 1}/${serializedTxs.length}] FAILED: ${err.message}`
      );

      if (abortOnFail) {
        return {
          success: false,
          results,
          error: `Transaction ${i + 1}/${serializedTxs.length} failed: ${err.message}`,
        };
      }
    }
  }

  return {
    success: results.every((r) => r.status === "confirmed"),
    results,
  };
}

/**
 * Persist orchestration results to ExecutionLog.
 */
export async function persistOrchestratorResult(
  proposalId: string,
  type: string,
  inputParams: string,
  result: OrchestratorResult
): Promise<void> {
  for (const txResult of result.results) {
    await prisma.executionLog.create({
      data: {
        proposalId,
        type,
        status: txResult.status,
        txSignature: txResult.signature || null,
        inputParams,
        outputData: JSON.stringify(txResult),
        error: txResult.error ?? null,
        executedAt: txResult.status === "confirmed" ? new Date() : null,
      },
    });
  }
}
