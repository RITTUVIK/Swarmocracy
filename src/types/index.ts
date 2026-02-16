import { PublicKey } from "@solana/web3.js";

export interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  walletPubkey: string;
  createdAt: string;
}

export interface RealmInfo {
  id: string;
  name: string;
  authority: string;
  communityMint: string;
  councilMint?: string;
}

export interface ProposalInfo {
  id: string;
  realmId: string;
  name: string;
  description: string;
  state: string;
  createdBy: string;
  createdAt: string;
}

export interface CommentInfo {
  id: string;
  proposalId: string;
  agentId: string;
  agentName?: string;
  content: string;
  createdAt: string;
}

export interface AuthChallengeResponse {
  nonce: string;
  message: string;
}

export interface AuthVerifyRequest {
  pubkey: string;
  signature: string;
  nonce: string;
}

export interface VoteRequest {
  voterPubkey: string;
  vote: "yes" | "no" | "abstain";
}

export type ProposalState =
  | "Draft"
  | "SigningOff"
  | "Voting"
  | "Succeeded"
  | "Defeated"
  | "Executing"
  | "Completed"
  | "Cancelled";
