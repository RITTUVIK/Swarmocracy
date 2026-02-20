import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getRealm, getAllGovernances } from "@solana/spl-governance";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedPubkey } from "@/lib/auth";
import { getConnection } from "@/lib/solana";
import { SPL_GOVERNANCE_PROGRAM_ID } from "@/lib/governance";

// Import an existing on-chain realm into Swarmocracy.
// Reads realm config directly from Solana devnet so we can interact with
// DAOs created externally (e.g. on realms.today or via CLI).
export async function POST(request: Request) {
  try {
    const pubkey = await getAuthenticatedPubkey(request);
    if (!pubkey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { realmPubkey, authoritySecret } = await request.json();

    if (!realmPubkey) {
      return NextResponse.json(
        { error: "realmPubkey is required" },
        { status: 400 }
      );
    }

    // Validate pubkey
    let realmPk: PublicKey;
    try {
      realmPk = new PublicKey(realmPubkey);
    } catch {
      return NextResponse.json(
        { error: "Invalid realm public key" },
        { status: 400 }
      );
    }

    // Check if already imported
    const existing = await prisma.realmCache.findUnique({
      where: { id: realmPubkey },
    });
    if (existing) {
      return NextResponse.json({
        message: "Realm already imported",
        realm: existing,
      });
    }

    // Read realm from Solana
    const connection = getConnection();
    let realmAccount;
    try {
      realmAccount = await getRealm(connection, realmPk);
    } catch (e) {
      return NextResponse.json(
        { error: "Realm not found on-chain. Check the pubkey and network." },
        { status: 404 }
      );
    }

    const realmData = realmAccount.account;
    const communityMint = realmData.communityMint.toBase58();
    const authority = realmData.authority?.toBase58() || pubkey;

    // Try to find governance accounts for this realm
    let governancePubkey: string | null = null;
    try {
      const governances = await getAllGovernances(
        connection,
        SPL_GOVERNANCE_PROGRAM_ID,
        realmPk
      );
      if (governances.length > 0) {
        governancePubkey = governances[0].pubkey.toBase58();
      }
    } catch {
      // No governances found, that's ok
    }

    // Cache in our DB
    const realm = await prisma.realmCache.create({
      data: {
        id: realmPubkey,
        name: realmData.name,
        authority,
        communityMint,
        governancePubkey,
        programVersion: 3,
        onChain: true,
        authoritySecret: authoritySecret || null,
      },
    });

    const { authoritySecret: _secret, ...safeRealm } = realm;
    return NextResponse.json(
      {
        message: "Realm imported from Solana",
        realm: safeRealm,
        governancePubkey,
        note: authoritySecret
          ? "Authority key stored — agents can join and receive governance tokens."
          : "No authority key provided. Set it later so agents can receive governance tokens on join.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Import realm error:", error);
    return NextResponse.json(
      { error: "Failed to import realm" },
      { status: 500 }
    );
  }
}
