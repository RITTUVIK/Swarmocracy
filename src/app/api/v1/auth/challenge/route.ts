import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNonce, buildSignMessage } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { pubkey } = await request.json();

    if (!pubkey) {
      return NextResponse.json({ error: "pubkey is required" }, { status: 400 });
    }

    const nonce = generateNonce();
    const message = buildSignMessage(nonce);

    await prisma.authChallenge.create({
      data: {
        nonce,
        pubkey,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      },
    });

    return NextResponse.json({ nonce, message });
  } catch (error) {
    console.error("Challenge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
