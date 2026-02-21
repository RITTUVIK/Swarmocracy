import { PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection } from "./solana";

let IDL: any;
let PROGRAM_ID: PublicKey;
let derivePairAddress: any;
let deriveUserPositionAddress: any;
let SEEDS: any;

async function loadSdk() {
  if (IDL) return;
  try {
    const sdk = await import("@omnipair/program-interface");
    IDL = sdk.IDL;
    PROGRAM_ID = sdk.PROGRAM_ID;
    SEEDS = sdk.SEEDS;
    if (sdk.derivePairAddress) derivePairAddress = sdk.derivePairAddress;
    if (sdk.deriveUserPositionAddress) deriveUserPositionAddress = sdk.deriveUserPositionAddress;
  } catch (err) {
    console.error("Failed to load @omnipair/program-interface:", err);
    PROGRAM_ID = new PublicKey("omnixgS8fnqHfCcTGKWj6JtKjzpJZ1Y5y9pyFkQDkYE");
  }
}

function getProvider(wallet: Keypair) {
  const connection = getConnection();
  const anchorWallet = new NodeWallet(wallet);
  return new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });
}

export interface BorrowParams {
  pairAddress: string;
  collateralMint: string;
  collateralAmount: string;
  borrowMint: string;
  borrowAmount: string;
}

export async function executeBorrow(
  treasuryKeypair: Keypair,
  params: BorrowParams
): Promise<{ txSignature: string }> {
  await loadSdk();

  const connection = getConnection();
  const provider = getProvider(treasuryKeypair);
  const payer = treasuryKeypair.publicKey;

  const pairPubkey = new PublicKey(params.pairAddress);
  const collateralMint = new PublicKey(params.collateralMint);
  const borrowMint = new PublicKey(params.borrowMint);
  const collateralAmount = new BN(params.collateralAmount);
  const borrowAmount = new BN(params.borrowAmount);

  if (!IDL) {
    throw new Error(
      "Omnipair SDK not available. Ensure @omnipair/program-interface is installed."
    );
  }

  const idlWithAddress = { ...IDL, address: PROGRAM_ID.toBase58() };
  const program = new Program(idlWithAddress as any, provider as any);

  const pair: any = await (program.account as any).pair.fetch(pairPubkey);

  const [userPositionAddress] = deriveUserPositionAddress
    ? deriveUserPositionAddress(pairPubkey, payer)
    : PublicKey.findProgramAddressSync(
        [
          Buffer.from(SEEDS?.POSITION ?? "gamm_position"),
          pairPubkey.toBuffer(),
          payer.toBuffer(),
        ],
        PROGRAM_ID
      );

  const collateralVaultAddress = await getAssociatedTokenAddress(
    collateralMint,
    pairPubkey,
    true
  );
  const userCollateralAccount = await getAssociatedTokenAddress(
    collateralMint,
    payer
  );

  const borrowVaultAddress = await getAssociatedTokenAddress(
    borrowMint,
    pairPubkey,
    true
  );
  const userBorrowAccount = await getAssociatedTokenAddress(borrowMint, payer);

  const addCollateralTx = await program.methods
    .addCollateral({
      amount: collateralAmount,
      token: collateralMint,
    })
    .accounts({
      pair: pairPubkey,
      userPosition: userPositionAddress,
      rateModel: pair.rateModel,
      collateralVault: collateralVaultAddress,
      userTokenAccount: userCollateralAccount,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const borrowTx = await program.methods
    .borrow({
      amount: borrowAmount,
      token: borrowMint,
    })
    .accounts({
      pair: pairPubkey,
      userPosition: userPositionAddress,
      rateModel: pair.rateModel,
      reserveVault: borrowVaultAddress,
      userTokenAccount: userBorrowAccount,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const combinedTx = new Transaction();
  combinedTx.add(...addCollateralTx.instructions, ...borrowTx.instructions);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  combinedTx.recentBlockhash = blockhash;
  combinedTx.lastValidBlockHeight = lastValidBlockHeight;
  combinedTx.feePayer = payer;

  combinedTx.sign(treasuryKeypair);

  const txSignature = await connection.sendRawTransaction(
    combinedTx.serialize(),
    { skipPreflight: false }
  );

  await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return { txSignature };
}
