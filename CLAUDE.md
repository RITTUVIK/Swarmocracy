# CLAUDE.md

Instructions for Claude Code when working on the Swarmocracy project.

## Project Overview

Swarmocracy is an AI-native governance and treasury control plane built on Solana Realms v2. It uses Next.js 14 (App Router) with Prisma + SQLite for local state, and proxies all governance operations to the Realms v2 REST API on Solana mainnet.

## Project Structure

```
src/
  app/
    (app)/           # Frontend routes (/, /daos, /dao/[realmPk], /agents, /treasury, /transactions)
    api/v1/          # All API routes
  lib/
    realmsClient.ts  # Realms v2 REST API client (read + write)
    realmsMcp.ts     # Realms MCP proxy client
    txOrchestrator.ts # Transaction signing, broadcast, and logging
    omnipair.ts      # OmniPair DeFi execution (borrow)
    treasury.ts      # Treasury key encryption/decryption
    walletManager.ts # Wallet role resolution (agent vs treasury)
    defiExecutor.ts  # DeFi execution with governance gating
    execution.ts     # Proposal execution dispatcher
    auth.ts          # JWT creation and verification
    solana.ts        # Solana connection and cluster detection
    prisma.ts        # Prisma client singleton
    wallet.ts        # Keypair utilities
    governance.ts    # Governance helpers
    sowellianBet.ts  # Sowellian bet validation
    explorerUrl.ts   # Solana explorer URL builder
prisma/
  schema.prisma      # Database schema
  dev.db             # SQLite database (DO NOT DELETE)
skills/
  swarmocracy/
    SKILL.md         # OpenClaw skill definition (agent-invocable API surface)
scripts/
  e2e-test.js        # End-to-end test suite (185 tests)
  demo.sh            # Demo script (agent onboard, browse DAOs, vote)
```

## Key Conventions

- Next.js 14 App Router. Pages in `src/app/(app)/`, API routes in `src/app/api/v1/`.
- Prisma + SQLite. The database at `prisma/dev.db` is the local cache and audit trail. Realms v2 API is the source of truth for all DAO state.
- API routes are all under `/api/v1/`. Write routes return unsigned Solana transactions; the orchestrator (`/api/v1/tx/orchestrate`) handles signing and broadcast.
- Realms API URL and MCP URL are configurable via `REALMS_API_URL` and `REALMS_MCP_URL` environment variables.
- The project uses mainnet Helius RPC by default. Cluster is auto-detected from the RPC URL.

## Critical Rules

- NEVER run `taskkill` on any process, for any reason, under any circumstances. If a file is locked (Prisma DLL, dev.db), ask the user to restart the server manually.
- NEVER delete `prisma/dev.db`. The user has existing data that must be preserved.
- NEVER reset or wipe the database "to test." Tests should work with existing data.
- If Prisma client is locked or the database file is busy, tell the user and ask them to stop the server. Do not attempt to kill processes.

## How to Run

```bash
npm install
npx prisma db push
npm run dev
```

The dev server runs at `http://localhost:3000`.

## Environment

- `.env.local` for local configuration.
- `.env.example` for reference values.
- Key variables: `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `REALMS_API_URL`, `REALMS_MCP_URL`, `JWT_SECRET`, `TREASURY_ENCRYPTION_KEY`.
- Defaults are defined in code (see `src/lib/solana.ts`, `src/lib/realmsClient.ts`, `src/lib/realmsMcp.ts`, `src/lib/auth.ts`, `src/lib/treasury.ts`).

## Testing

```bash
# Full e2e test suite (185 tests, 182 passing, 3 skipped for on-chain ops)
node scripts/e2e-test.js

# Demo script
bash scripts/demo.sh
```

Both run against `http://localhost:3000`. Start the dev server first.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/realmsClient.ts` | All Realms v2 API calls (DAOs, proposals, treasury, members, governances, delegates, write operations) |
| `src/lib/txOrchestrator.ts` | Transaction signing, broadcast, confirmation, and execution log persistence |
| `src/lib/omnipair.ts` | OmniPair DeFi execution (borrow with collateral) |
| `src/lib/treasury.ts` | Treasury key encryption/decryption (AES-256-CBC with scrypt) |
| `src/lib/walletManager.ts` | Wallet role resolution: agent vs treasury keypair selection |
| `src/lib/defiExecutor.ts` | DeFi execution dispatcher with governance gating |
| `src/lib/realmsMcp.ts` | MCP proxy client for Realms AI tools |
| `src/lib/auth.ts` | JWT signing, verification, and authenticated pubkey extraction |
| `prisma/schema.prisma` | Database models: Agent, TreasuryConfig, ExecutionLog, OmniPairExecution, ProtocolEvent, etc. |
| `skills/swarmocracy/SKILL.md` | OpenClaw skill definition with full API usage examples |

## Database Models

Core models in `prisma/schema.prisma`:
- `Agent` : AI agent identity, wallet, governance config
- `TreasuryConfig` : Per-realm treasury wallet with encrypted key
- `WalletRoleRecord` : Tracks wallet roles (agent vs treasury)
- `ExecutionLog` : Transaction execution audit trail
- `OmniPairExecution` : OmniPair-specific DeFi execution records
- `ProtocolEvent` : High-level event log for activity feed
- `ProposalCache` : Local proposal cache with execution state
- `Vote`, `Comment`, `RealmMember`, `AuthChallenge` : Supporting models
