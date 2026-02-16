import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  withCreateRealm,
  withDepositGoverningTokens,
  withCreateGovernance,
  withCreateProposal,
  withAddSignatory,
  withSignOffProposal,
  withCastVote,
  getGovernanceProgramVersion,
  getTokenOwnerRecordAddress,
  getGovernance,
  GovernanceConfig,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  MintMaxVoteWeightSource,
  VoteType,
  VoteTypeKind,
  Vote,
  VoteKind,
  VoteChoice,
} from "@solana/spl-governance";
import {
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import BN from "bn.js";
import { getConnection } from "./solana";

const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey(
  "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
);

// Cached program version
let cachedProgramVersion: number | null = null;

export async function getProgramVersion(): Promise<number> {
  if (cachedProgramVersion !== null) return cachedProgramVersion;
  const connection = getConnection();
  try {
    cachedProgramVersion = await getGovernanceProgramVersion(
      connection,
      SPL_GOVERNANCE_PROGRAM_ID
    );
  } catch {
    cachedProgramVersion = 3; // default to v3
  }
  return cachedProgramVersion;
}

/**
 * Create a realm on-chain. Server signs + submits (authority creates realm).
 * Split into 2 transactions to stay within size limits:
 *   TX1: create mint + init mint + withCreateRealm
 *   TX2: create ATA + mint 1 token + withDepositGoverningTokens + withCreateGovernance
 */
export async function createRealm(
  walletKeypair: Keypair,
  realmName: string
): Promise<{
  realmPubkey: string;
  communityMint: string;
  governancePubkey: string;
  programVersion: number;
}> {
  const connection = getConnection();
  const programVersion = await getProgramVersion();
  const payer = walletKeypair.publicKey;

  // --- TX1: Create mint + Create Realm ---
  const mintKeypair = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);

  const tx1Instructions: TransactionInstruction[] = [];

  // Create mint account
  tx1Instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // Initialize mint (0 decimals for governance tokens)
  tx1Instructions.push(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0,
      payer, // mint authority
      payer // freeze authority
    )
  );

  // Create realm via SDK
  const realmAddress = await withCreateRealm(
    tx1Instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmName,
    payer, // realm authority
    mintKeypair.publicKey, // community mint
    payer, // payer
    undefined, // council mint
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
    new BN(1), // min community weight to create governance
    undefined, // community token config
    undefined // council token config
  );

  const tx1 = new Transaction().add(...tx1Instructions);
  tx1.feePayer = payer;
  const { blockhash: bh1 } = await connection.getLatestBlockhash();
  tx1.recentBlockhash = bh1;
  tx1.sign(walletKeypair, mintKeypair);

  const sig1 = await connection.sendRawTransaction(tx1.serialize());
  await connection.confirmTransaction(sig1);

  // --- TX2: Create ATA + Mint token + Deposit + Create Governance ---
  const tx2Instructions: TransactionInstruction[] = [];

  // Create ATA for authority
  const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, payer);
  tx2Instructions.push(
    createAssociatedTokenAccountInstruction(
      payer,
      ata,
      payer,
      mintKeypair.publicKey
    )
  );

  // Mint 1 token to authority
  tx2Instructions.push(
    createMintToInstruction(mintKeypair.publicKey, ata, payer, 1)
  );

  // Deposit governing tokens
  await withDepositGoverningTokens(
    tx2Instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmAddress,
    ata, // source token account
    mintKeypair.publicKey, // governing token mint
    payer, // token owner
    payer, // transfer authority
    payer, // payer
    new BN(1) // amount
  );

  // Get token owner record for governance creation
  const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
    SPL_GOVERNANCE_PROGRAM_ID,
    realmAddress,
    mintKeypair.publicKey,
    payer
  );

  // Create governance
  const governanceConfig = new GovernanceConfig({
    communityVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 60,
    }),
    minCommunityTokensToCreateProposal: new BN(1),
    minInstructionHoldUpTime: 0,
    baseVotingTime: 3 * 24 * 60 * 60, // 3 days
    communityVoteTipping: VoteTipping.Strict,
    councilVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.Disabled,
    }),
    councilVetoVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.Disabled,
    }),
    communityVetoVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.Disabled,
    }),
    councilVoteTipping: VoteTipping.Disabled,
    minCouncilTokensToCreateProposal: new BN(1),
    votingCoolOffTime: 0,
    depositExemptProposalCount: 0,
  });

  // Use the realm itself as the governed account
  const governancePk = await withCreateGovernance(
    tx2Instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmAddress,
    realmAddress, // governed account = realm itself
    governanceConfig,
    tokenOwnerRecordPk,
    payer, // payer
    payer // create authority
  );

  const tx2 = new Transaction().add(...tx2Instructions);
  tx2.feePayer = payer;
  const { blockhash: bh2 } = await connection.getLatestBlockhash();
  tx2.recentBlockhash = bh2;
  tx2.sign(walletKeypair);

  const sig2 = await connection.sendRawTransaction(tx2.serialize());
  await connection.confirmTransaction(sig2);

  return {
    realmPubkey: realmAddress.toBase58(),
    communityMint: mintKeypair.publicKey.toBase58(),
    governancePubkey: governancePk.toBase58(),
    programVersion,
  };
}

/**
 * Mint governance tokens to a recipient. Server signs (authority holds mint authority).
 * Fixed ATA bug: getAccountInfo returns null (not throws) for missing accounts.
 */
export async function mintGovernanceTokens(
  walletKeypair: Keypair,
  mint: PublicKey,
  recipient: PublicKey,
  amount: number
): Promise<string> {
  const connection = getConnection();
  const ata = await getAssociatedTokenAddress(mint, recipient);
  const tx = new Transaction();

  // Fixed: getAccountInfo returns null, doesn't throw
  const accountInfo = await connection.getAccountInfo(ata);
  if (!accountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey,
        ata,
        recipient,
        mint
      )
    );
  }

  tx.add(createMintToInstruction(mint, ata, walletKeypair.publicKey, amount));

  tx.feePayer = walletKeypair.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(walletKeypair);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig);
  return sig;
}

/**
 * Build unsigned deposit-governing-tokens transaction.
 * The agent (tokenOwner) must sign this.
 */
export async function buildDepositTx(
  realmPubkey: PublicKey,
  communityMint: PublicKey,
  tokenOwner: PublicKey
): Promise<{ transaction: string; tokenOwnerRecordPk: string }> {
  const connection = getConnection();
  const programVersion = await getProgramVersion();
  const instructions: TransactionInstruction[] = [];

  const ata = await getAssociatedTokenAddress(communityMint, tokenOwner);

  await withDepositGoverningTokens(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmPubkey,
    ata, // source token account
    communityMint,
    tokenOwner, // token owner
    tokenOwner, // transfer authority (agent signs)
    tokenOwner, // payer (agent pays)
    new BN(1)
  );

  const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
    SPL_GOVERNANCE_PROGRAM_ID,
    realmPubkey,
    communityMint,
    tokenOwner
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = tokenOwner;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return {
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    tokenOwnerRecordPk: tokenOwnerRecordPk.toBase58(),
  };
}

/**
 * Build unsigned create-proposal + sign-off transaction.
 * The proposer (walletPubkey) must sign this.
 */
export async function buildCreateProposalTx(
  walletPubkey: PublicKey,
  realmPubkey: PublicKey,
  governancePubkey: PublicKey,
  communityMint: PublicKey,
  name: string,
  description: string,
  proposalIndex: number
): Promise<{ transaction: string; proposalPubkey: string }> {
  const connection = getConnection();
  const programVersion = await getProgramVersion();
  const instructions: TransactionInstruction[] = [];

  const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
    SPL_GOVERNANCE_PROGRAM_ID,
    realmPubkey,
    communityMint,
    walletPubkey
  );

  const proposalPk = await withCreateProposal(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmPubkey,
    governancePubkey,
    tokenOwnerRecordPk,
    name,
    description,
    communityMint,
    walletPubkey, // governance authority (proposer)
    proposalIndex,
    new VoteType({ type: VoteTypeKind.SingleChoice, choiceType: undefined, minVoterOptions: undefined, maxVoterOptions: undefined, maxWinningOptions: undefined }),
    ["Approve"], // options
    true, // use deny option
    walletPubkey // payer
  );

  // Add proposer as signatory so they can sign off immediately
  const signatoryRecordPk = await withAddSignatory(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    proposalPk,
    tokenOwnerRecordPk,
    walletPubkey, // governance authority
    walletPubkey, // signatory = proposer themselves
    walletPubkey // payer
  );

  // Sign off the proposal to move it to Voting state
  await withSignOffProposal(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmPubkey,
    governancePubkey,
    proposalPk,
    walletPubkey, // signatory
    signatoryRecordPk,
    tokenOwnerRecordPk
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = walletPubkey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return {
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    proposalPubkey: proposalPk.toBase58(),
  };
}

/**
 * Build unsigned cast-vote transaction.
 * The voter (voterPubkey) must sign this.
 */
export async function buildCastVoteTx(
  voterPubkey: PublicKey,
  realmPubkey: PublicKey,
  governancePubkey: PublicKey,
  proposalPubkey: PublicKey,
  proposalCreatorPubkey: PublicKey,
  communityMint: PublicKey,
  voteKind: "yes" | "no" | "abstain"
): Promise<{ transaction: string; voteRecordPk: string }> {
  const connection = getConnection();
  const programVersion = await getProgramVersion();
  const instructions: TransactionInstruction[] = [];

  // Build the Vote object based on voteKind
  let vote: Vote;
  if (voteKind === "yes") {
    vote = new Vote({
      voteType: VoteKind.Approve,
      approveChoices: [
        new VoteChoice({ rank: 0, weightPercentage: 100 }),
      ],
      deny: undefined,
      veto: undefined,
    });
  } else if (voteKind === "no") {
    vote = new Vote({
      voteType: VoteKind.Deny,
      approveChoices: undefined,
      deny: true,
      veto: undefined,
    });
  } else {
    // Abstain uses VoteKind.Abstain but the Vote struct doesn't have an abstain field;
    // it's encoded as voteType only, with no approve/deny/veto set
    vote = new Vote({
      voteType: VoteKind.Abstain,
      approveChoices: undefined,
      deny: undefined,
      veto: undefined,
    });
  }

  const voterTokenOwnerRecord = await getTokenOwnerRecordAddress(
    SPL_GOVERNANCE_PROGRAM_ID,
    realmPubkey,
    communityMint,
    voterPubkey
  );

  const proposalOwnerRecord = await getTokenOwnerRecordAddress(
    SPL_GOVERNANCE_PROGRAM_ID,
    realmPubkey,
    communityMint,
    proposalCreatorPubkey
  );

  const voteRecordPk = await withCastVote(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    programVersion,
    realmPubkey,
    governancePubkey,
    proposalPubkey,
    proposalOwnerRecord,
    voterTokenOwnerRecord,
    voterPubkey, // governance authority (voter)
    communityMint,
    vote,
    voterPubkey // payer
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = voterPubkey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  return {
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    voteRecordPk: voteRecordPk.toBase58(),
  };
}

/**
 * Get the current proposal count from an on-chain governance account.
 * Used to determine the next proposal index.
 */
export async function getProposalCount(
  governancePubkey: PublicKey
): Promise<number> {
  const connection = getConnection();
  try {
    const governance = await getGovernance(connection, governancePubkey);
    return governance.account.proposalCount;
  } catch {
    return 0;
  }
}

export { SPL_GOVERNANCE_PROGRAM_ID };
