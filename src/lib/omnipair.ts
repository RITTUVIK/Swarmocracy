/**
 * OmniPair instruction builder.
 *
 * This module builds unsigned transaction instructions for OmniPair operations.
 * It NEVER signs transactions. Signing is handled by the treasury authority
 * through the execution layer after governance approval.
 *
 * Supported operations: borrow, lend, repay, refinance
 */

import { PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection } from "./solana";

let IDL: any;
let PROGRAM_ID: PublicKey;
let SEEDS: any;

async function loadSdk() {
  if (IDL) return;
  try {
    const sdk = await import("@omnipair/program-interface");
    IDL = sdk.IDL;
    PROGRAM_ID = sdk.PROGRAM_ID;
    SEEDS = sdk.SEEDS;
  } catch {
    PROGRAM_ID = new PublicKey("omnixgS8fnqHfCcTGKWj6JtKjzpJZ1Y5y9pyFkQDkYE");
  }
}

function getReadOnlyProvider() {
  const connection = getConnection();
  const dummyWallet = new NodeWallet(Keypair.generate());
  return new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
}

function getProgram() {
  if (!IDL) throw new Error("OmniPair SDK not loaded. Call loadSdk() first.");
  const idlWithAddress = { ...IDL, address: PROGRAM_ID.toBase58() };
  return new Program(idlWithAddress as any, getReadOnlyProvider() as any);
}

function deriveUserPosition(pair: PublicKey, user: PublicKey): PublicKey {
  const [addr] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS?.POSITION ?? "gamm_position"), pair.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
  return addr;
}

// ─── Types ───────────────────────────────────────────────────────────

export type OmniPairAction = "borrow" | "lend" | "repay" | "refinance";

export interface BorrowParams {
  pairAddress: string;
  collateralMint: string;
  collateralAmount: string;
  borrowMint: string;
  borrowAmount: string;
}

export interface LendParams {
  pairAddress: string;
  lendMint: string;
  lendAmount: string;
}

export interface RepayParams {
  pairAddress: string;
  repayMint: string;
  repayAmount: string;
}

export interface RefinanceParams {
  pairAddress: string;
  collateralMint: string;
  borrowMint: string;
  repayAmount: string;
  newBorrowAmount: string;
}

// ─── Instruction Builders ────────────────────────────────────────────

/**
 * Build unsigned borrow instructions (add collateral + borrow).
 * Returns serialized instructions — never signs.
 */
export async function buildBorrowInstructions(
  payer: PublicKey,
  params: BorrowParams
): Promise<TransactionInstruction[]> {
  await loadSdk();
  const program = getProgram();

  const pairPk = new PublicKey(params.pairAddress);
  const collateralMint = new PublicKey(params.collateralMint);
  const borrowMint = new PublicKey(params.borrowMint);
  const collateralAmount = new BN(params.collateralAmount);
  const borrowAmount = new BN(params.borrowAmount);

  const pair: any = await (program.account as any).pair.fetch(pairPk);
  const userPosition = deriveUserPosition(pairPk, payer);

  const collateralVault = await getAssociatedTokenAddress(collateralMint, pairPk, true);
  const userCollateral = await getAssociatedTokenAddress(collateralMint, payer);
  const borrowVault = await getAssociatedTokenAddress(borrowMint, pairPk, true);
  const userBorrow = await getAssociatedTokenAddress(borrowMint, payer);

  const addCollateralIx = await program.methods
    .addCollateral({ amount: collateralAmount, token: collateralMint })
    .accounts({
      pair: pairPk, userPosition, rateModel: pair.rateModel,
      collateralVault, userTokenAccount: userCollateral,
      payer, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();

  const borrowIx = await program.methods
    .borrow({ amount: borrowAmount, token: borrowMint })
    .accounts({
      pair: pairPk, userPosition, rateModel: pair.rateModel,
      reserveVault: borrowVault, userTokenAccount: userBorrow,
      payer, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [addCollateralIx, borrowIx];
}

/**
 * Build unsigned lend (deposit) instructions.
 */
export async function buildLendInstructions(
  payer: PublicKey,
  params: LendParams
): Promise<TransactionInstruction[]> {
  await loadSdk();
  const program = getProgram();

  const pairPk = new PublicKey(params.pairAddress);
  const lendMint = new PublicKey(params.lendMint);
  const amount = new BN(params.lendAmount);

  const pair: any = await (program.account as any).pair.fetch(pairPk);
  const vault = await getAssociatedTokenAddress(lendMint, pairPk, true);
  const userToken = await getAssociatedTokenAddress(lendMint, payer);

  const ix = await program.methods
    .deposit({ amount, token: lendMint })
    .accounts({
      pair: pairPk, rateModel: pair.rateModel,
      reserveVault: vault, userTokenAccount: userToken,
      payer, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [ix];
}

/**
 * Build unsigned repay instructions.
 */
export async function buildRepayInstructions(
  payer: PublicKey,
  params: RepayParams
): Promise<TransactionInstruction[]> {
  await loadSdk();
  const program = getProgram();

  const pairPk = new PublicKey(params.pairAddress);
  const repayMint = new PublicKey(params.repayMint);
  const amount = new BN(params.repayAmount);

  const pair: any = await (program.account as any).pair.fetch(pairPk);
  const userPosition = deriveUserPosition(pairPk, payer);
  const vault = await getAssociatedTokenAddress(repayMint, pairPk, true);
  const userToken = await getAssociatedTokenAddress(repayMint, payer);

  const ix = await program.methods
    .repay({ amount, token: repayMint })
    .accounts({
      pair: pairPk, userPosition, rateModel: pair.rateModel,
      reserveVault: vault, userTokenAccount: userToken,
      payer, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [ix];
}

/**
 * Build unsigned refinance instructions (repay existing + borrow new amount).
 */
export async function buildRefinanceInstructions(
  payer: PublicKey,
  params: RefinanceParams
): Promise<TransactionInstruction[]> {
  const repayIxs = await buildRepayInstructions(payer, {
    pairAddress: params.pairAddress,
    repayMint: params.borrowMint,
    repayAmount: params.repayAmount,
  });

  const borrowIxs = await buildBorrowInstructions(payer, {
    pairAddress: params.pairAddress,
    collateralMint: params.collateralMint,
    collateralAmount: "0",
    borrowMint: params.borrowMint,
    borrowAmount: params.newBorrowAmount,
  });

  return [...repayIxs, ...borrowIxs];
}

/**
 * Assemble instructions into an unsigned Transaction (for serialization / orchestration).
 */
export async function buildUnsignedTransaction(
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<Transaction> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.add(...instructions);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  return tx;
}

/**
 * Legacy compat: execute a borrow with a keypair (signs + sends).
 * Used by defiExecutor.ts for backward compatibility.
 */
export async function executeBorrow(
  treasuryKeypair: Keypair,
  params: BorrowParams
): Promise<{ txSignature: string }> {
  const payer = treasuryKeypair.publicKey;
  const instructions = await buildBorrowInstructions(payer, params);
  const tx = await buildUnsignedTransaction(payer, instructions);

  tx.sign(treasuryKeypair);

  const connection = getConnection();
  const txSignature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");

  return { txSignature };
}
