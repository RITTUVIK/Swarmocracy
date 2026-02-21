import { getConnection } from "./solana";

const REALMS_API = "https://v2.realms.today/api/v1";

// ─── Types ────────────────────────────────────────────────────────────

export interface RealmsDAO {
  realmPk: string;
  name: string;
  communityMint: string;
  councilMint?: string;
  authority?: string;
  governances: RealmsGovernance[];
  membersCount?: number;
}

export interface RealmsGovernance {
  governancePk: string;
  governedAccountPk: string;
  config: {
    communityVoteThresholdPercentage: number;
    minCommunityTokensToCreateProposal: string;
    baseVotingTime: number;
    voteTipping: string;
  };
}

export interface RealmsProposal {
  proposalPk: string;
  governancePk: string;
  name: string;
  description: string;
  state: string;
  yesVotesCount: string;
  noVotesCount: string;
  abstainVoteWeight?: string;
  denyVoteWeight?: string;
  vetoVoteWeight?: string;
  maxVoteWeight?: string;
  votingAt?: string;
  votingCompletedAt?: string;
  executingAt?: string;
  closedAt?: string;
  createdAt: string;
  tokenOwnerRecord: string;
  signatoryRecord?: string;
  instructions: RealmsInstruction[];
}

export interface RealmsInstruction {
  instructionPk: string;
  programId: string;
  data: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
}

export interface RealmsTreasuryAsset {
  mintPk: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: number;
  tokenAccountPk: string;
}

export interface RealmsMember {
  walletPk: string;
  communityVotingPower: string;
  councilVotingPower?: string;
  totalVotesCount: number;
  outstandingProposalsCount: number;
}

export interface RealmsDelegate {
  delegatePk: string;
  delegatorPk: string;
  tokenType: string;
}

export interface RealmsTxResponse {
  transactions: string[];
  message?: string;
}

export type ProposalStateFilter =
  | "all"
  | "Draft"
  | "SigningOff"
  | "Voting"
  | "Succeeded"
  | "Executing"
  | "Completed"
  | "Cancelled"
  | "Defeated"
  | "ExecutingWithErrors";

// ─── Error ────────────────────────────────────────────────────────────

export class RealmsApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public endpoint: string
  ) {
    super(`Realms API [${statusCode}] ${endpoint}: ${message}`);
    this.name = "RealmsApiError";
  }
}

// ─── Client ───────────────────────────────────────────────────────────

const responseCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 10_000;

async function realmsGet<T>(path: string, cacheTtl = CACHE_TTL_MS): Promise<T> {
  const url = `${REALMS_API}${path}`;
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as T;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RealmsApiError(res.status, text, path);
  }

  const data = await res.json();
  responseCache.set(url, { data, ts: Date.now() });
  return data as T;
}

async function realmsPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${REALMS_API}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RealmsApiError(res.status, text, path);
  }

  return (await res.json()) as T;
}

// ─── Read Endpoints ───────────────────────────────────────────────────

function normalizeDAO(d: Record<string, unknown>): RealmsDAO {
  // Realms v2 API returns publicKey (realm id), mint (community mint)
  const realmPk =
    (d.realmPk as string) ??
    (d.realm_pk as string) ??
    (d.publicKey as string) ??
    (d.pubkey as string) ??
    "";
  return {
    realmPk,
    name: (d.name as string) ?? "",
    communityMint:
      (d.communityMint as string) ??
      (d.community_mint as string) ??
      (d.mint as string) ??
      "",
    councilMint: (d.councilMint as string) ?? (d.council_mint as string) ?? (d.council as string),
    authority: (d.authority as string),
    governances: (d.governances as RealmsGovernance[]) ?? [],
    membersCount: (d.membersCount as number) ?? (d.members_count as number),
  };
}

export async function listDAOs(): Promise<RealmsDAO[]> {
  const raw = await realmsGet<unknown>("/daos");
  const list = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.daos ?? [];
  return (list as Record<string, unknown>[])
    .map(normalizeDAO)
    .filter((d) => d.realmPk);
}

export async function getDAO(realmPk: string): Promise<RealmsDAO> {
  // API returns { pubkey, account: { name, communityMint, councilMint, authority, ... } }
  const raw = await realmsGet<Record<string, unknown>>(`/daos/${realmPk}`);
  const account = (raw.account ?? {}) as Record<string, unknown>;
  return {
    realmPk: (raw.pubkey as string) ?? (raw.publicKey as string) ?? realmPk,
    name: (account.name as string) ?? (raw.name as string) ?? "",
    communityMint: (account.communityMint as string) ?? (raw.mint as string) ?? "",
    councilMint: (account.councilMint as string) ?? undefined,
    authority: (account.authority as string) ?? (raw.authority as string),
    governances: [],
    membersCount: undefined,
  };
}

const PROPOSAL_STATE_MAP: Record<number, string> = {
  0: "Draft",
  1: "SigningOff",
  2: "Voting",
  3: "Succeeded",
  4: "Executing",
  5: "Completed",
  6: "Cancelled",
  7: "Defeated",
  8: "ExecutingWithErrors",
};

function normalizeProposal(raw: Record<string, unknown>): RealmsProposal {
  const account = (raw.account ?? {}) as Record<string, unknown>;
  const stateNum = account.state as number | undefined;
  const stateStr =
    typeof stateNum === "number"
      ? PROPOSAL_STATE_MAP[stateNum] ?? String(stateNum)
      : (account.state as string) ?? "Unknown";

  return {
    proposalPk: (raw.pubkey as string) ?? "",
    governancePk: (account.governance as string) ?? "",
    name: (account.name as string) ?? "",
    description: (account.descriptionLink as string) ?? "",
    state: stateStr,
    yesVotesCount: "0",
    noVotesCount: "0",
    createdAt: (account.draftAt as string) ?? "",
    tokenOwnerRecord: (account.tokenOwnerRecord as string) ?? "",
    instructions: [],
  };
}

export async function listProposals(
  realmPk: string,
  state?: ProposalStateFilter
): Promise<RealmsProposal[]> {
  const q = state && state !== "all" ? `?state=${state}` : "";
  const raw = await realmsGet<unknown[]>(`/daos/${realmPk}/proposals${q}`);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .map(normalizeProposal)
    .filter((p) => p.proposalPk);
}

export async function getProposal(
  realmPk: string,
  proposalPk: string
): Promise<RealmsProposal> {
  const raw = await realmsGet<Record<string, unknown>>(
    `/daos/${realmPk}/proposals/${proposalPk}`
  );
  return normalizeProposal(raw);
}

export async function getTreasury(realmPk: string): Promise<RealmsTreasuryAsset[]> {
  // API returns: [{ governance, nativeTreasury, solBalance }]
  // Each entry is a governance wallet. Multiple can hold SOL.
  // Use nativeTreasury as unique key (not mintPk) since many wallets hold SOL.
  const raw = await realmsGet<unknown[]>(`/daos/${realmPk}/treasury`);
  if (!Array.isArray(raw)) return [];

  const assets: RealmsTreasuryAsset[] = [];

  for (const item of raw as Record<string, unknown>[]) {
    const solBalance = (item.solBalance as number) ?? 0;
    const nativeTreasury = (item.nativeTreasury as string) ?? "";
    const governance = (item.governance as string) ?? "";

    if (solBalance > 0) {
      assets.push({
        mintPk: nativeTreasury,
        symbol: "SOL",
        name: `${governance.slice(0, 6)}...${governance.slice(-4)}`,
        decimals: 9,
        balance: solBalance.toFixed(6),
        usdValue: 0,
        tokenAccountPk: nativeTreasury,
      });
    }

    const tokens = item.tokens as Record<string, unknown>[] | undefined;
    if (Array.isArray(tokens)) {
      for (const t of tokens) {
        assets.push({
          mintPk: (t.mint as string) ?? (t.mintPk as string) ?? "",
          symbol: (t.symbol as string) ?? "???",
          name: (t.name as string) ?? "",
          decimals: (t.decimals as number) ?? 0,
          balance: String(t.balance ?? t.uiAmount ?? 0),
          usdValue: (t.usdValue as number) ?? 0,
          tokenAccountPk: (t.tokenAccount as string) ?? (t.tokenAccountPk as string) ?? "",
        });
      }
    }
  }

  return assets;
}

export async function getGovernances(realmPk: string): Promise<RealmsGovernance[]> {
  return realmsGet<RealmsGovernance[]>(`/daos/${realmPk}/governances`);
}

export async function getMembers(realmPk: string): Promise<RealmsMember[]> {
  // API returns: [{ pubkey, account: { governingTokenOwner, governingTokenDepositAmount, unrelinquishedVotesCount, ... } }]
  const raw = await realmsGet<unknown[]>(`/daos/${realmPk}/members`);
  if (!Array.isArray(raw)) return [];

  return (raw as Record<string, unknown>[])
    .map((item) => {
      const account = (item.account ?? {}) as Record<string, unknown>;
      return {
        walletPk:
          (account.governingTokenOwner as string) ??
          (account.walletPk as string) ??
          (item.pubkey as string) ??
          "",
        communityVotingPower:
          (account.governingTokenDepositAmount as string) ?? "0",
        totalVotesCount: (account.unrelinquishedVotesCount as number) ?? 0,
        outstandingProposalsCount: (account.outstandingProposalCount as number) ?? 0,
      };
    })
    .filter((m) => m.walletPk);
}

export async function getDelegates(realmPk: string): Promise<RealmsDelegate[]> {
  return realmsGet<RealmsDelegate[]>(`/daos/${realmPk}/delegates`);
}

// ─── Write Endpoints (return unsigned txs) ────────────────────────────

export async function createDAO(params: {
  name: string;
  communityMintPk?: string;
  walletPk: string;
  minCommunityTokensToCreateProposal?: string;
  communityVoteThresholdPercentage?: number;
}): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>("/daos/create", params);
}

export async function createProposal(
  realmPk: string,
  params: {
    name: string;
    description: string;
    governancePk: string;
    walletPk: string;
    isDraft?: boolean;
    instructions?: {
      programId: string;
      data: string;
      accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    }[];
  }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/proposals/create`, params);
}

export async function createSowellianBet(
  realmPk: string,
  params: {
    walletPk: string;
    governancePk: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    expiry?: number;
    description?: string;
  }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/proposals/create-bet`, params);
}

export async function castVote(
  realmPk: string,
  proposalPk: string,
  params: {
    walletPk: string;
    vote: "yes" | "no" | "abstain" | "veto";
  }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(
    `/daos/${realmPk}/proposals/${proposalPk}/vote`,
    params
  );
}

export async function executeProposalOnRealms(
  realmPk: string,
  proposalPk: string
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(
    `/daos/${realmPk}/proposals/${proposalPk}/execute`,
    {}
  );
}

export async function cancelProposal(
  realmPk: string,
  proposalPk: string,
  params: { walletPk: string }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(
    `/daos/${realmPk}/proposals/${proposalPk}/cancel`,
    params
  );
}

export async function finalizeVoting(
  realmPk: string,
  proposalPk: string
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(
    `/daos/${realmPk}/proposals/${proposalPk}/finalize`,
    {}
  );
}

export async function joinDAO(
  realmPk: string,
  params: { walletPk: string; amount?: string }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/join`, params);
}

export async function leaveDAO(
  realmPk: string,
  params: { walletPk: string }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/leave`, params);
}

export async function delegateVote(
  realmPk: string,
  params: { walletPk: string; delegatePk: string; tokenType?: string }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/delegate`, params);
}

export async function undelegateVote(
  realmPk: string,
  params: { walletPk: string; delegatePk: string; tokenType?: string }
): Promise<RealmsTxResponse> {
  return realmsPost<RealmsTxResponse>(`/daos/${realmPk}/undelegate`, params);
}
