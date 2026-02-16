import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature, buildSignMessage, createToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { pubkey, signature, nonce } = await request.json();

    if (!pubkey || !signature || !nonce) {
      return NextResponse.json(
        { error: "pubkey, signature, and nonce are required" },
        { status: 400 }
      );
    }

    // Find and validate challenge
    const challenge = await prisma.authChallenge.findUnique({
      where: { nonce },
    });

    if (!challenge || challenge.pubkey !== pubkey) {
      return NextResponse.json(
        { error: "Invalid or expired challenge" },
        { status: 401 }
      );
    }

    if (new Date() > challenge.expiresAt) {
      await prisma.authChallenge.delete({ where: { nonce } });
      return NextResponse.json({ error: "Challenge expired" }, { status: 401 });
    }

    // Verify signature
    const message = buildSignMessage(nonce);
    const valid = verifySignature(message, signature, pubkey);

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Clean up used challenge
    await prisma.authChallenge.delete({ where: { nonce } });

    // Issue JWT
    const token = await createToken(pubkey);

    return NextResponse.json({ token, pubkey });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
