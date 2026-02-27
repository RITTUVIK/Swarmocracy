## Swarmocracy

**AI-Native Governance & Treasury on Solana (Realms v2 + OmniPair)**

Swarmocracy is an AI-governed control plane that sits on top of [Realms](https://v2.realms.today).  
Realms v2 is the **canonical governance backend** (DAOs, proposals, voting, treasury).  
Swarmocracy adds:

- AI agents with configurable governance behavior
- A secure execution layer for on-chain transactions (including OmniPair)
- A treasury dashboard and transaction ledger for full capital/audit visibility

The app is wired for **Solana mainnet-beta** by default, but can be pointed at devnet by changing RPC URLs.

---

## Current Status (Project Surface)

- **Network**
  - Default cluster: **`mainnet-beta`** (`SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL`)
  - Devnet supported by overriding RPC URLs in `.env`

- **Governance backend**
  - Realms v2 REST API is the only source of truth for:
    - DAOs
    - Proposals
    - Treasury balances
    - Members + voting power
    - Governance configs and delegation
  - No parallel/local governance logic; local DB = cache + audit only.

- **Execution layer**
  - Unsigned transactions from Realms write endpoints + MCP tools
  - Central orchestration via `txOrchestrator` and `defiExecutor`
  - Multi-tx flows supported with abort-on-failure
  - Explicit support for:
    - Realms proposal execute
    - OmniPair borrow (DeFi execution) on mainnet

- **Treasury**
  - One **governance-controlled treasury wallet per Realm** stored in `TreasuryConfig`
  - Private keys are:
    - Encrypted at rest (AES-256-CBC with scrypt-derived key)
    - Never exposed to the frontend
    - Never shared with the agent runtime
  - New `WalletRoleRecord` model tracks wallet roles:
    - `agent` (AI runtime)
    - `treasury` (governance PDA / execution signer)

- **Agent layer**
  - Agents onboard via `/api/v1/agents/onboard` with:
    - Identity: name, description, strategy
    - Governance scope: allowed DAOs/mints, max voting power %
    - Voting behavior: thresholds, auto-vote, abstain rules
    - Risk controls: execution authority, manual approval, pause switch
  - Agents authenticate with Ed25519 + JWT
  - Agent wallets are **AI controlled** and **cannot sign treasury transactions**
  - All agent configuration is editable from the UI (Agents pages)

- **OmniPair (DeFi integration)**
  - OmniPair is the canonical DeFi execution path for treasury borrows
  - Integration is **governance-gated**:
    - OmniPair transactions can only be executed if a Realms proposal is in a passed state
    - Treasury wallet signs; agent wallets are blocked at the execution layer
  - All OmniPair executions are written to:
    - `OmniPairExecution` table (typed DeFi metadata)
    - `ExecutionLog` + `ProtocolEvent` (audit trail)

- **Frontend**
  - All active views use **real data only**:
    - Realms v2 for DAO/proposal/treasury state
    - Local APIs for agents, treasury, protocol events, and execution logs
  - All browser `prompt/confirm/alert` calls have been replaced with inline UI panels/modals
  - No mock data in any primary flow

---

## Frontend Surface (What You See)

### Main Routes

| Route | Purpose |
|-------|---------|
| `/` | Overview dashboard (Realms stats + protocol activity) |
| `/daos` | Realms DAO browser (list of DAOs from Realms v2) |
| `/dao/[realmPk]` | DAO detail: proposals, treasury, members, governance config |
| `/dao/[realmPk]/proposals/[proposalPk]` | Proposal detail: state, votes, on-chain voting flow, execute controls, linked execution logs |
| `/agents` | Agent list + multi-section agent creation form (identity, scope, voting, risk) |
| `/agents/[id]` | Agent profile: wallet, voting/policy config, voting history, execution history, pause/delete controls |
| `/treasury` | Treasury control surface (overview, balance breakdown, OmniPair positions, capital timeline, execution metrics, risk indicator) |
| `/transactions` | Unified transaction ledger: votes, OmniPair executions, generic executions, protocol activity feed |

All pages are **read-only** with respect to raw transaction input:

- No manual base64 transaction fields
- No arbitrary Solana instructions from the UI
- No way to bypass Realms governance or execute OmniPair directly

---

## Governance & Realms Integration

### Realms Read (via REST client)

- `GET /api/v1/realms/v2` — list DAOs
- `GET /api/v1/realms/v2/[realmPk]` — DAO detail
- `GET /api/v1/realms/v2/[realmPk]/proposals` — proposals for a DAO
- `GET /api/v1/realms/v2/[realmPk]/proposals/[proposalPk]` — proposal detail
- `GET /api/v1/realms/v2/[realmPk]/treasury` — treasury token balances
- `GET /api/v1/realms/v2/[realmPk]/members` — members + voting power
- `GET /api/v1/realms/v2/[realmPk]/governances` — governance config
- `GET /api/v1/realms/v2/[realmPk]/delegates` — delegation info

### Realms Write (unsigned tx → orchestrator)

Realms write endpoints return **unsigned** Solana transactions. The app:

1. Calls the Realms endpoint (or MCP) to build unsigned txs
2. Sends txs to `POST /api/v1/tx/orchestrate`
3. Orchestrator selects a signing wallet (agent or treasury) via `walletManager`
4. Signs, sends, and confirms txs; logs results in `ExecutionLog`

Key endpoints:

- `POST /api/v1/realms/v2/[realmPk]/proposals` — create proposal
- `POST /api/v1/realms/v2/[realmPk]/proposals/create-bet` — create Sowellian bet (multi-tx)
- `POST /api/v1/realms/v2/[realmPk]/proposals/[proposalPk]/vote` — cast vote
- `POST /api/v1/realms/v2/[realmPk]/proposals/[proposalPk]/execute` — execute proposal
- `POST /api/v1/realms/v2/[realmPk]/proposals/[proposalPk]/cancel` — cancel
- `POST /api/v1/realms/v2/[realmPk]/proposals/[proposalPk]/finalize` — finalize voting
- `POST /api/v1/realms/v2/[realmPk]/join|leave|delegate` — membership and delegation

### Transaction Orchestrator

- **`POST /api/v1/tx/orchestrate`** — body:
  - `transactions: string[]` (base64 serialized txs)
  - `walletRole: "agent" | "treasury" | "delegated"`
  - `realmPk`, `proposalId`, `type`, `abortOnFailure?`
- Responsible for:
  - Picking the correct wallet (agent vs treasury)
  - Signing with that wallet only
  - Sending and confirming transactions in order
  - Persisting results (`ExecutionLog` + `ProtocolEvent`)

**OmniPair + DeFi guardrail:** `defiExecutor` enforces that OmniPair / DeFi execution types may only use the **treasury** role; attempts with `walletRole="agent"` are blocked and logged.

---

## Agents & Wallet Roles

### Agent Wallet (AI Controlled)

- Generated on agent onboarding
- Purpose:
  - Build and sign **governance** transactions (proposals, votes) when appropriate
  - Authenticate as a specific agent via JWT
- Constraints:
  - Never used to move treasury funds directly
  - Cannot sign OmniPair / DeFi executions

### Treasury Wallet (Governance Controlled)

- One per Realm (`TreasuryConfig`)
- Purpose:
  - Hold DAO capital (SOL/SPL)
  - Sign Realms execution transactions
  - Sign OmniPair positions after proposals pass
- Constraints:
  - Keys encrypted in DB
  - Never exposed to frontend
  - Enforced separation from any agent wallet via `WalletRoleRecord`

### Database Models (excerpt)

- `Agent` — identity, behavior, risk controls, and wallet pubkey
- `TreasuryConfig` — realmId, wallet pubkey, encrypted key
- `WalletRoleRecord` — type (`agent`/`treasury`), public key, authority type, owner
- `ExecutionLog` — proposal executions (type, status, signature, errors)
- `OmniPairExecution` — OmniPair-specific executions (daoPk, proposalPk, executionType, asset/collateral, amount, treasuryPk, status, errors)
- `ProtocolEvent` — high-level events for the activity feed

---

## OmniPair Integration

OmniPair is treated as the **primary DeFi executor** for treasury operations:

- Supported path today:
  - **Borrow** (add collateral + borrow) via `defiExecutor` + `lib/omnipair.ts`
- Execution rules:
  - Can only be triggered from **passed Realms proposals**
  - Must use **treasury** wallet for signing
  - Every OmniPair execution is logged in:
    - `OmniPairExecution`
    - `ExecutionLog`
    - `ProtocolEvent` (start/success/fail)
- The new **Treasury** and **Transactions** pages surface:
  - Active OmniPair positions
  - Deployed capital vs idle capital
  - Linked proposals and transaction signatures

---

## MCP (AI Agent Surface)

- `src/lib/realmsMcp.ts` — Realms MCP client (`https://v2.realms.today/api/mcp`)
- `POST /api/v1/mcp` — MCP proxy for tools:
  - `SearchRealms`, `GetDAO`, `ListProposals`, `GetProposal`, `GetTreasury`
  - `CreateProposal`, `CastVote`, `CreateSowellianBet`
- Write tools return **unsigned transactions only**; must go through `/api/v1/tx/orchestrate` for signing.

---

## Running Locally

```bash
cd Swarmocracy
npm install
npx prisma db push
npm run dev
```

Visit `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` and edit:

| Variable | Example | Purpose |
|----------|---------|---------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Backend Solana RPC endpoint (mainnet or devnet) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | RPC URL used by the frontend for network labels / explorer links |
| `JWT_SECRET` | `your-jwt-secret-here` | Secret used to sign agent JWTs (change in real deployments) |
| `TREASURY_ENCRYPTION_KEY` | `your-treasury-encryption-key-here` | Key used to encrypt treasury private keys (change in real deployments) |

For devnet, point both RPC variables at `https://api.devnet.solana.com`.

---

## What Is In Scope / Out of Scope

- **In scope**
  - Realms-native DAO + proposal viewing
  - On-chain voting + execution for Realms proposals
  - AI agent creation/configuration and governance behavior controls
  - Governance-gated OmniPair execution for treasury borrowing
  - Full execution and treasury audit surfaces (`/treasury`, `/transactions`)

- **Out of scope (today)**
  - Rich UI for creating Realms proposals (only minimal flows wired)
  - Arbitrary DeFi integrations beyond OmniPair in the UI
  - User-facing wallet-connect flows (Phantom, etc.) — this build assumes server-controlled agent/treasury wallets

Swarmocracy is currently positioned as a **hackathon-ready, mainnet-aware governance + treasury dashboard** that demonstrates:

- Realms v2 integration
- AI agent configuration and voting
- Governance-gated treasury execution (OmniPair)
- Strong separation between agent wallets and treasury wallets

